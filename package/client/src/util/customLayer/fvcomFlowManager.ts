import { Shader } from '../renderUtils/shader'
import mapboxgl from 'mapbox-gl'
const rand = (min: number, max: number) => {
    if (max === undefined) {
        max = min
        min = 0
    }
    return Math.random() * (max - min) + min
}

async function loadShaderUrl(
    gl: WebGL2RenderingContext,
    name: string,
    vertexUrl: string,
    fragmentUrl: string,
    transformFeedbackVaryings?: Array<string>,
): Promise<Shader> {
    const [vertexSource, fragmentSource] = await Promise.all([
        fetch(vertexUrl).then((r) => r.text()),
        fetch(fragmentUrl).then((r) => r.text()),
    ])
    return new Shader(gl, name, [vertexSource, fragmentSource], transformFeedbackVaryings)
}

function makeBuffer(
    gl: WebGL2RenderingContext,
    target: number,
    srcData: Float32Array,
    usage: number,
): WebGLBuffer {
    const vbo = gl.createBuffer()!
    gl.bindBuffer(target, vbo)
    gl.bufferData(target, srcData as unknown as ArrayBuffer, usage)
    gl.bindBuffer(target, null)
    return vbo
}

function loadTextureFromImage(
    gl: WebGL2RenderingContext,
    img: HTMLImageElement | ImageBitmap,
    interpolationType: number,
): WebGLTexture {
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, interpolationType)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, interpolationType)
    return texture
}

export interface FvcomTextureSet {
    uvTexture1: string  // uvdp1 image URL
    uvTexture2?: string // uvdp2 image URL
    meshTexture1: string  // mesh1 / projection image URL
    meshTexture2?: string // mesh2 / projection image URL
    seedTexture?: string  // seed/address texture URL
    bounds: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
}

// Inline shaders for mesh overlay rendering
const MESH_VERT_SRC = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 texcoords;
uniform mat4 u_matrix;
void main() {
    gl_Position = u_matrix * vec4(aPos, 0.0, 1.0);
    texcoords = aUv;
}`

const MESH_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 texcoords;
uniform sampler2D meshTexture;
out vec4 fragColor;
void main() {
    vec4 c = texture(meshTexture, texcoords);
    fragColor = vec4(c.r * 1.2, c.g * 0.8, c.b * 1.5, 0.55);
}`

export class FvcomFlowManager {
    // Shaders
    private updateShader: Shader | null = null
    private drawShader: Shader | null = null
    private meshShader: Shader | null = null

    // Textures
    private flowTexture1: WebGLTexture | null = null
    private flowTexture2: WebGLTexture | null = null
    private maskTexture1: WebGLTexture | null = null
    private maskTexture2: WebGLTexture | null = null
    private meshTexture1: WebGLTexture | null = null
    private seedTexture: WebGLTexture | null = null
    private hasFlowTexture2 = false

    // Particle simulation resources
    private simulationVAO: WebGLVertexArrayObject | null = null
    private renderVAO: WebGLVertexArrayObject | null = null
    private simulationBuffer: WebGLBuffer | null = null
    private lifeBuffer: WebGLBuffer | null = null
    private xfSimulationBuffer: WebGLBuffer | null = null
    private xfLifeBuffer: WebGLBuffer | null = null
    private particlePool: WebGLTexture | null = null
    private UBO: WebGLBuffer | null = null
    private XFBO: WebGLTransformFeedback | null = null

    // Mesh overlay resources
    private meshVAO: WebGLVertexArrayObject | null = null
    private meshPosBuffer: WebGLBuffer | null = null
    private meshUvBuffer: WebGLBuffer | null = null

    // Parameters (derived from texture dimensions)
    private maxTextureSize = 2048
    private maxStreamlineNum = 65536
    private maxSegmentNum = 32
    private maxBlockSize = 256
    private maxBlockColumn = 8

    private uboBuffer = new Float32Array(12)
    private particleBuffer: Float32Array | null = null
    private textureOffsets: Array<{ offsetX: number; offsetY: number }> = []

    private beginBlock = 0
    private geoBbox: number[] = [0, 0, 0, 0]
    public uMatrix: number[] = []
    public zoomRate = 1.0

    public controller = {
        progressRate: 0,
        segmentNum: 32,
        fullLife: 96,
        dropRate: 0.003,
        dropRateBump: 0.001,
        speedFactor: 2.0,
        fillWidth: 1.5,
        aaWidth: 1.0,
    }

    constructor(
        private textureSet: FvcomTextureSet,
    ) {
        // Convert geographic bounds to mercator
        const min = mapboxgl.MercatorCoordinate.fromLngLat([textureSet.bounds[0], textureSet.bounds[1]])
        const max = mapboxgl.MercatorCoordinate.fromLngLat([textureSet.bounds[2], textureSet.bounds[3]])
        this.geoBbox = [min.x, min.y, max.x, max.y]
    }

    get ready(): boolean {
        return this.flowTexture1 !== null && this.meshTexture1 !== null
    }

    async prepare(gl: WebGL2RenderingContext, _map: mapboxgl.Map): Promise<boolean> {

        try {
            // Load all texture images in parallel
            const images = await this.loadTextureImages()
            if (!images) return false

            // ── 转换 FVCOM UV 纹理（左半 float32 u，右半 float32 v）→ 着色器期望的 RGBA 字节格式 ──
            const converted1 = this.convertUvImage(gl, images.uv1)
            if (!converted1) return false
            this.flowTexture1 = converted1.texture

            // 设置流速边界
            this.uboBuffer[8] = converted1.minU
            this.uboBuffer[9] = converted1.minV
            this.uboBuffer[10] = converted1.maxU
            this.uboBuffer[11] = converted1.maxV

            // mask1：从 uv1 生成（有效单元格 = 1.0）
            const mask1 = this.generateMaskTexture(gl, images.uv1)
            if (mask1) this.maskTexture1 = mask1

            if (images.uv2) {
                const converted2 = this.convertUvImage(gl, images.uv2)
                if (converted2) {
                    this.flowTexture2 = converted2.texture
                    this.hasFlowTexture2 = true
                }
                const mask2 = this.generateMaskTexture(gl, images.uv2)
                if (mask2) this.maskTexture2 = mask2
            }

            // 网格/投影纹理
            this.meshTexture1 = loadTextureFromImage(gl, images.mesh1, gl.NEAREST)

            // 种子纹理：如果存在 texture.png 且尺寸不对，重新生成
            if (images.seed) {
                const logicalWidth = images.uv1.width / 2
                if (images.seed.width === logicalWidth && images.seed.height === images.uv1.height) {
                    this.seedTexture = loadTextureFromImage(gl, images.seed, gl.NEAREST)
                } else {
                    console.warn('seed texture dimension mismatch, generating default seed')
                    this.seedTexture = this.generateSeedTexture(gl, logicalWidth, images.uv1.height)
                }
            } else {
                const logicalWidth = images.uv1.width / 2
                this.seedTexture = this.generateSeedTexture(gl, logicalWidth, images.uv1.height)
            }

            // Derive parameters from texture dimensions
            this.deriveParams(images)

            // Setup particle resources
            this.setupParticleResources(gl)

            // Load shaders
            this.updateShader = await loadShaderUrl(
                gl, 'fvcom_update',
                '/shaders/update.vert', '/shaders/update.frag',
                ['newPosition', 'aliveTime'],
            )
            this.drawShader = await loadShaderUrl(
                gl, 'fvcom_draw',
                '/shaders/ribbonParticle.vert', '/shaders/ribbonParticle.frag',
            )

            // Mesh overlay shader (inline)
            this.meshShader = new Shader(gl, 'fvcom_mesh', [MESH_VERT_SRC, MESH_FRAG_SRC])

            return true
        } catch (err) {
            console.error('FvcomFlowManager prepare failed:', err)
            return false
        }
    }

    /**
     * 将 FVCOM 的 float32 分体 UV 纹理转换为着色器期望的 RGBA 字节格式
     * FVCOM 格式：物理宽度 = logicalWidth × 2，左半为 float32 u，右半为 float32 v
     * 着色器期望：每个像素 R=u_int, G=u_frac, B=v_int, A=v_frac
     */
    private convertUvImage(
        gl: WebGL2RenderingContext,
        img: HTMLImageElement,
    ): { texture: WebGLTexture; minU: number; maxU: number; minV: number; maxV: number } | null {
        try {
            const physicalWidth = img.width
            const logicalWidth = physicalWidth / 2
            const height = img.height

            const canvas = document.createElement('canvas')
            canvas.width = physicalWidth
            canvas.height = height
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, physicalWidth, height)
            const view = new DataView(imageData.data.buffer)

            // 解码 float32 并计算 min/max
            let minU = Infinity, maxU = -Infinity
            let minV = Infinity, maxV = -Infinity

            for (let canvasY = 0; canvasY < height; canvasY++) {
                for (let x = 0; x < logicalWidth; x++) {
                    const uOff = (canvasY * physicalWidth + x) * 4
                    const vOff = (canvasY * physicalWidth + logicalWidth + x) * 4
                    const u = view.getFloat32(uOff, true)
                    const v = view.getFloat32(vOff, true)
                    if (isFinite(u) && isFinite(v) && u > -99998) {
                        if (u < minU) minU = u
                        if (u > maxU) maxU = u
                        if (v < minV) minV = v
                        if (v > maxV) maxV = v
                    }
                }
            }

            if (maxU <= minU) { maxU = minU + 1 }
            if (maxV <= minV) { maxV = minV + 1 }

            // 创建输出像素数据（翻转 Y：canvas row 0 = 影像顶部 = grid 北部 → 输出底部）
            const out = new Uint8Array(logicalWidth * height * 4)
            for (let canvasY = 0; canvasY < height; canvasY++) {
                const gridY = height - 1 - canvasY  // Y 翻转
                for (let x = 0; x < logicalWidth; x++) {
                    const uOff = (canvasY * physicalWidth + x) * 4
                    const vOff = (canvasY * physicalWidth + logicalWidth + x) * 4
                    const u = view.getFloat32(uOff, true)
                    const v = view.getFloat32(vOff, true)
                    const idx = (gridY * logicalWidth + x) * 4
                    const valid = isFinite(u) && isFinite(v) && u > -99998
                    if (valid) {
                        const uNorm = Math.max(0, Math.min(1, (u - minU) / (maxU - minU)))
                        const vNorm = Math.max(0, Math.min(1, (v - minV) / (maxV - minV)))
                        const uI = Math.floor(uNorm * 255)
                        const uF = Math.floor((uNorm * 255 - uI) * 255)
                        const vI = Math.floor(vNorm * 255)
                        const vF = Math.floor((vNorm * 255 - vI) * 255)
                        out[idx] = Math.min(255, uI)
                        out[idx + 1] = Math.min(255, uF)
                        out[idx + 2] = Math.min(255, vI)
                        out[idx + 3] = Math.min(255, vF)
                    }
                }
            }

            const texture = gl.createTexture()!
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, logicalWidth, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, out)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
            gl.bindTexture(gl.TEXTURE_2D, null)

            return { texture, minU, maxU, minV, maxV }
        } catch (err) {
            console.error('convertUvImage failed:', err)
            return null
        }
    }

    /** 从 UV 纹理生成 mask（有效格点 = 255） */
    private generateMaskTexture(gl: WebGL2RenderingContext, img: HTMLImageElement): WebGLTexture | null {
        try {
            const physicalWidth = img.width
            const logicalWidth = physicalWidth / 2
            const height = img.height

            const canvas = document.createElement('canvas')
            canvas.width = physicalWidth
            canvas.height = height
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, physicalWidth, height)
            const view = new DataView(imageData.data.buffer)

            const out = new Uint8Array(logicalWidth * height)
            for (let canvasY = 0; canvasY < height; canvasY++) {
                const gridY = height - 1 - canvasY  // 与 convertUvImage 一致的 Y 翻转
                for (let x = 0; x < logicalWidth; x++) {
                    const uOff = (canvasY * physicalWidth + x) * 4
                    const u = view.getFloat32(uOff, true)
                    const vOff = (canvasY * physicalWidth + logicalWidth + x) * 4
                    const v = view.getFloat32(vOff, true)
                    out[gridY * logicalWidth + x] = (isFinite(u) && isFinite(v) && u > -99998) ? 255 : 0
                }
            }

            const texture = gl.createTexture()!
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, logicalWidth, height, 0, gl.RED, gl.UNSIGNED_BYTE, out)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
            gl.bindTexture(gl.TEXTURE_2D, null)
            return texture
        } catch {
            return null
        }
    }

    /** 生成默认种子纹理（每个格点指向自身） */
    private generateSeedTexture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture | null {
        try {
            const out = new Uint8Array(width * height * 4)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4
                    out[idx] = (x >> 8) & 0xff
                    out[idx + 1] = x & 0xff
                    out[idx + 2] = (y >> 8) & 0xff
                    out[idx + 3] = y & 0xff
                }
            }
            const texture = gl.createTexture()!
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, out)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
            gl.bindTexture(gl.TEXTURE_2D, null)
            return texture
        } catch {
            return null
        }
    }

    private async loadTextureImages(): Promise<{
        uv1: HTMLImageElement
        uv2?: HTMLImageElement
        mesh1: HTMLImageElement
        mesh2?: HTMLImageElement
        seed?: HTMLImageElement
    } | null> {
        const loadImage = (url: string): Promise<HTMLImageElement> =>
            new Promise((resolve, reject) => {
                const img = new Image()
                img.crossOrigin = 'anonymous'
                img.onload = () => resolve(img)
                img.onerror = () => reject(new Error(`Failed to load: ${url}`))
                img.src = url
            })

        try {
            const results = await Promise.all([
                loadImage(this.textureSet.uvTexture1),
                this.textureSet.uvTexture2 ? loadImage(this.textureSet.uvTexture2) : undefined,
                loadImage(this.textureSet.meshTexture1),
                this.textureSet.meshTexture2 ? loadImage(this.textureSet.meshTexture2) : undefined,
                this.textureSet.seedTexture ? loadImage(this.textureSet.seedTexture) : undefined,
            ] as const)

            return {
                uv1: results[0] as HTMLImageElement,
                uv2: results[1] as HTMLImageElement | undefined,
                mesh1: results[2] as HTMLImageElement,
                mesh2: results[3] as HTMLImageElement | undefined,
                seed: results[4] as HTMLImageElement | undefined,
            }
        } catch {
            return null
        }
    }

    private deriveParams(images: NonNullable<Awaited<ReturnType<typeof this.loadTextureImages>>>) {
        const uvHeight = images.uv1.height
        const logicalWidth = images.uv1.width / 2

        this.maxTextureSize = 2048  // 固定值，给粒子池足够的空间
        this.maxStreamlineNum = Math.min(65536, logicalWidth * uvHeight)
        this.maxSegmentNum = 32
        this.maxBlockSize = Math.ceil(Math.sqrt(this.maxStreamlineNum))
        this.maxBlockColumn = Math.floor(this.maxTextureSize / this.maxBlockSize)

        this.controller.segmentNum = this.maxSegmentNum
        this.controller.fullLife = this.maxSegmentNum * 3
    }

    private setupParticleResources(gl: WebGL2RenderingContext) {
        const MAX_STREAMLINE_NUM = this.maxStreamlineNum
        const MAX_SEGMENT_NUM = this.maxSegmentNum
        const MAX_TEXTURE_SIZE = this.maxTextureSize
        const BLOCK_SIZE = this.maxBlockSize

        // Calculate texture offsets for each segment
        this.textureOffsets = []
        for (let i = 0; i < MAX_SEGMENT_NUM; i++) {
            this.textureOffsets.push({
                offsetX: (i % this.maxBlockColumn) * BLOCK_SIZE,
                offsetY: Math.floor(i / this.maxBlockColumn) * BLOCK_SIZE,
            })
        }

        // Initialize particle positions
        this.particleBuffer = new Float32Array(BLOCK_SIZE * BLOCK_SIZE * 3).fill(0)
        for (let i = 0; i < MAX_STREAMLINE_NUM; i++) {
            this.particleBuffer[i * 3 + 0] = rand(0, 1.0)
            this.particleBuffer[i * 3 + 1] = rand(0, 1.0)
            this.particleBuffer[i * 3 + 2] = rand(0, 0.1)
        }

        // Particle countdown
        const countdownArray = new Float32Array(MAX_STREAMLINE_NUM)
        for (let i = 0; i < MAX_STREAMLINE_NUM; i++) {
            countdownArray[i] = Math.floor(rand(this.controller.segmentNum, this.controller.fullLife))
        }

        // Setup buffers
        this.simulationBuffer = makeBuffer(
            gl, gl.ARRAY_BUFFER,
            this.particleBuffer.slice(0, MAX_STREAMLINE_NUM * 3),
            gl.DYNAMIC_DRAW,
        )
        this.xfSimulationBuffer = makeBuffer(
            gl, gl.TRANSFORM_FEEDBACK_BUFFER,
            this.particleBuffer.slice(0, MAX_STREAMLINE_NUM * 3),
            gl.DYNAMIC_DRAW,
        )
        this.lifeBuffer = makeBuffer(gl, gl.ARRAY_BUFFER, countdownArray, gl.DYNAMIC_DRAW)
        this.xfLifeBuffer = makeBuffer(gl, gl.TRANSFORM_FEEDBACK_BUFFER, countdownArray, gl.DYNAMIC_DRAW)

        // UBO
        this.UBO = gl.createBuffer()!
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.UBO)
        gl.bufferData(gl.UNIFORM_BUFFER, 48, gl.DYNAMIC_DRAW)
        gl.bindBuffer(gl.UNIFORM_BUFFER, null)

        // Particle pool texture
        this.particlePool = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, this.particlePool)
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32F, MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        for (let i = 0; i < MAX_SEGMENT_NUM; i++) {
            gl.texSubImage2D(
                gl.TEXTURE_2D, 0,
                this.textureOffsets[i].offsetX, this.textureOffsets[i].offsetY,
                BLOCK_SIZE, BLOCK_SIZE,
                gl.RGB, gl.FLOAT, this.particleBuffer,
            )
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

        // Simulation VAO
        this.simulationVAO = gl.createVertexArray()
        gl.bindVertexArray(this.simulationVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.simulationBuffer)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0)
        gl.enableVertexAttribArray(0)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer)
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 4, 0)
        gl.enableVertexAttribArray(1)
        gl.bindVertexArray(null)

        // Render VAO
        this.renderVAO = gl.createVertexArray()
        gl.bindVertexArray(this.renderVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer)
        gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 4, 0)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribDivisor(0, 1)
        gl.bindVertexArray(null)

        // Transform feedback
        this.XFBO = gl.createTransformFeedback()
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.XFBO)
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.xfSimulationBuffer)
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.xfSimulationBuffer, 0, MAX_STREAMLINE_NUM * 12)
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.xfLifeBuffer)
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.xfLifeBuffer, 0, MAX_STREAMLINE_NUM * 4)
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null)

        gl.bindBuffer(gl.ARRAY_BUFFER, null)
        gl.bindTexture(gl.TEXTURE_2D, null)

        // Setup mesh overlay quad
        const bbox = this.geoBbox
        const quadPos = new Float32Array([
            bbox[0], bbox[1],  // bottom-left
            bbox[2], bbox[1],  // bottom-right
            bbox[0], bbox[3],  // top-left
            bbox[2], bbox[3],  // top-right
        ])
        const quadUv = new Float32Array([
            0.0, 0.0,  // south → UV.y=0 → texture row 0 = south（loadTextureFromImage 翻转后）
            1.0, 0.0,
            0.0, 1.0,  // north → UV.y=1 → texture row height-1 = north
            1.0, 1.0,
        ])

        this.meshPosBuffer = makeBuffer(gl, gl.ARRAY_BUFFER, quadPos, gl.STATIC_DRAW)
        this.meshUvBuffer = makeBuffer(gl, gl.ARRAY_BUFFER, quadUv, gl.STATIC_DRAW)

        this.meshVAO = gl.createVertexArray()
        gl.bindVertexArray(this.meshVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPosBuffer)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0)
        gl.enableVertexAttribArray(0)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUvBuffer)
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, 0)
        gl.enableVertexAttribArray(1)
        gl.bindVertexArray(null)
    }

    tick() {
        this.beginBlock = (this.beginBlock + 1) % this.maxSegmentNum
        const progressRate = this.beginBlock / this.maxSegmentNum

        this.uboBuffer[0] = this.hasFlowTexture2 ? progressRate : 0
        this.uboBuffer[1] = this.controller.segmentNum
        this.uboBuffer[2] = this.controller.segmentNum * 3
        this.uboBuffer[3] = this.controller.dropRate
        this.uboBuffer[4] = this.controller.dropRateBump
        this.uboBuffer[5] = this.controller.speedFactor * 0.01 * 100
        // indices 6-7 padding (unused)
        // indices 8-11 flowBoundary — set once during prepare()
    }

    render(gl: WebGL2RenderingContext) {
        if (!this.ready || !this.updateShader || !this.drawShader) return

        // Bind UBO
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.UBO)
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uboBuffer)
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.UBO)

        // Pass 1: Simulation
        const mask1 = this.maskTexture1 ?? this.flowTexture1
        const mask2 = this.maskTexture2 ?? (this.hasFlowTexture2 ? this.flowTexture2 : this.flowTexture1)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.flowTexture1)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, mask1)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, this.hasFlowTexture2 ? this.flowTexture2 : this.flowTexture1)
        gl.activeTexture(gl.TEXTURE3)
        gl.bindTexture(gl.TEXTURE_2D, mask2)
        gl.activeTexture(gl.TEXTURE4)
        gl.bindTexture(gl.TEXTURE_2D, this.seedTexture ?? this.flowTexture1)

        this.updateShader.use(gl)
        this.updateShader.setInt(gl, 'flowField1', 0)
        this.updateShader.setInt(gl, 'mask1', 1)
        this.updateShader.setInt(gl, 'flowField2', 2)
        this.updateShader.setInt(gl, 'mask2', 3)
        this.updateShader.setInt(gl, 'validAddress', 4)
        this.updateShader.setFloat(gl, 'randomSeed', Math.random())
        this.updateShader.setUniformBlock(gl, 'FlowFieldUniforms', 0)
        this.updateShader.setFloat2(gl, 'boundary', gl.canvas.width, gl.canvas.height)

        gl.enable(gl.RASTERIZER_DISCARD)
        gl.bindVertexArray(this.simulationVAO)
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.XFBO)
        gl.beginTransformFeedback(gl.POINTS)
        gl.drawArrays(gl.POINTS, 0, this.maxStreamlineNum)
        gl.endTransformFeedback()
        gl.bindVertexArray(null)
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
        gl.disable(gl.RASTERIZER_DISCARD)

        // Copy transform feedback results back
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.xfLifeBuffer)
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, this.lifeBuffer)
        gl.copyBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, this.maxStreamlineNum * 4)
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.xfSimulationBuffer)
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, this.simulationBuffer)
        gl.copyBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, this.maxStreamlineNum * 12)

        // Read back particle data and update pool texture
        gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.particleBuffer!, 0, this.maxStreamlineNum * 3)
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null)

        gl.bindTexture(gl.TEXTURE_2D, this.particlePool)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        gl.texSubImage2D(
            gl.TEXTURE_2D, 0,
            this.textureOffsets[this.beginBlock].offsetX,
            this.textureOffsets[this.beginBlock].offsetY,
            this.maxBlockSize, this.maxBlockSize,
            gl.RGB, gl.FLOAT, this.particleBuffer,
        )

        // Pass 2: Render streamlines
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.bindVertexArray(this.renderVAO)
        this.drawShader.use(gl)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.particlePool)
        this.drawShader.setInt(gl, 'particlePool', 0)
        this.drawShader.setInt(gl, 'blockNum', this.maxSegmentNum)
        this.drawShader.setInt(gl, 'beginBlock', this.beginBlock)
        this.drawShader.setInt(gl, 'blockSize', this.maxBlockSize)
        this.drawShader.setFloat(gl, 'fillWidth', this.controller.fillWidth)
        this.drawShader.setFloat(gl, 'aaWidth', this.controller.aaWidth)
        this.drawShader.setFloat2(gl, 'viewport', gl.canvas.width, gl.canvas.height)
        this.drawShader.setVec4(gl, 'bbox', this.geoBbox)
        this.drawShader.setMat4(gl, 'u_matrix', this.uMatrix)
        this.drawShader.setUniformBlock(gl, 'FlowFieldUniforms', 0)

        gl.drawArraysInstanced(
            gl.TRIANGLE_STRIP, 0,
            (this.controller.segmentNum - 1) * 2,
            Math.floor(this.maxStreamlineNum * this.zoomRate),
        )

        gl.disable(gl.BLEND)
        gl.bindVertexArray(null)
        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    renderMesh(gl: WebGL2RenderingContext) {
        if (!this.meshShader || !this.meshVAO || !this.meshTexture1) return

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.bindVertexArray(this.meshVAO)
        this.meshShader.use(gl)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.meshTexture1)
        this.meshShader.setInt(gl, 'meshTexture', 0)
        this.meshShader.setMat4(gl, 'u_matrix', this.uMatrix)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        gl.disable(gl.BLEND)
        gl.bindVertexArray(null)
        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    destroy() {
        this.updateShader = null
        this.drawShader = null
        this.meshShader = null
        this.flowTexture1 = null
        this.flowTexture2 = null
        this.maskTexture1 = null
        this.maskTexture2 = null
        this.meshTexture1 = null
        this.seedTexture = null
        this.simulationVAO = null
        this.renderVAO = null
        this.meshVAO = null
        this.simulationBuffer = null
        this.lifeBuffer = null
        this.xfSimulationBuffer = null
        this.xfLifeBuffer = null
        this.particlePool = null
        this.UBO = null
        this.XFBO = null
        this.meshPosBuffer = null
        this.meshUvBuffer = null
        this.particleBuffer = null
    }
}
