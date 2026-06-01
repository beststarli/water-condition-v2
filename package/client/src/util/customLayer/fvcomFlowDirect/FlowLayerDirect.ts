import type { DirectFlowFieldHost, FlowProgressState } from './types';
import { CustomLayer } from './CustomLayer';
import type { Map } from 'mapbox-gl';
import { textureManager } from './core/managers';
import { Shader } from './platform/WebGL2/shader/shader';
import type { TextureViewInfo } from './platform/WebGL2/texture/textureView';
import { ScratchDataFormat } from './platform/dataFormat';
import updateVert from './glsl/update.vert?raw';
import updateFrag from './glsl/update.frag?raw';
import trajectoryVert from './glsl/trajectory.noCulling.vert?raw';
import trajectoryFrag from './glsl/trajectory.noCulling.frag?raw';
import pointVert from './glsl/point.noCulling.vert?raw';
import pointFrag from './glsl/point.noCulling.frag?raw';
import poolVert from './glsl/showPool.vert?raw';
import poolFrag from './glsl/showPool.frag?raw';
import maskVert from './glsl/mask.vert?raw';
import maskFrag from './glsl/mask.frag?raw';

const stf = ScratchDataFormat;
const stm = textureManager;

// Create random positions
const rand = (min: number, max?: number) => {

    if (!max) {
        max = min;
        min = 0;
    }
    return Math.random() * (max - min) + min;
};

function renderContextSetting (gl: WebGL2RenderingContext) {
    const available_extensions = gl.getSupportedExtensions()!;
    for (const extension of available_extensions)
    {
        gl.getExtension(extension);
    }
    textureManager.SetContext(gl);

}

function loadShaderSource(
    gl: WebGL2RenderingContext,
    name: string,
    vertexSource: string,
    fragmentSource: string,
    transformFeedbackVaryings?: Array<string>,
) : Shader {
    return new Shader(gl, name, [vertexSource, fragmentSource], transformFeedbackVaryings);
}

function makeBufferBySource(gl: WebGL2RenderingContext, target: number, srcData: AllowSharedBufferSource, usage: number): WebGLBuffer | null {

    const vbo = gl.createBuffer();
    if (vbo == null) {
        console.log("ERROR::Vertex Buffer cannot be created!");
        return vbo;
    }

    gl.bindBuffer(target, vbo);
    gl.bufferData(target, srcData, usage);
    gl.bindBuffer(target, null);
    return vbo;
}

function makeBufferBySize(gl: WebGL2RenderingContext, target: number, dataSize: number, usage: number): WebGLBuffer | null {

    const vbo = gl.createBuffer();
    if (vbo == null) {
        console.log("ERROR::Vertex Buffer cannot be created!");
        return vbo;
    }

    gl.bindBuffer(target, vbo);
    gl.bufferData(target, dataSize, usage);
    gl.bindBuffer(target, null);
    return vbo;
}

interface TextureOffset {

    offsetX: number;
    offsetY: number;
}

class FlowLayer_Direct extends CustomLayer {
    public ffManager: DirectFlowFieldHost;
    public map: Map | null = null;
    public ready = false;
    public visible = true;
    public meshVisible = false;
    public useWorker = false;

    // Member for simulation
    private simulationVAO: WebGLVertexArrayObject = 0;
    private simulationVAO2: WebGLVertexArrayObject = 0;
    private XFBO: WebGLTransformFeedback = 0;
    private XFBO2: WebGLTransformFeedback = 0;
    private sVAO: WebGLVertexArrayObject = 0;
    private xfBO: WebGLTransformFeedback = 0;

    private simulationBuffer: WebGLBuffer = 0;
    private xfSimulationBuffer: WebGLBuffer = 0;
    private lifeBuffer: WebGLBuffer = 0;
    private xfLifeBuffer: WebGLBuffer = 0;
    private unPackBuffer: WebGLBuffer = 0;
    private UBO: WebGLBuffer = 0;

    private updateShader: Shader | null = null;

    private maxBlockSize = 0.0;
    private _timeCount = 0.0;
    private timeLast = 10.0;
    private phaseCount = 0.0;
    private flowFieldTextureSize = [0.0, 0.0];
    private flowFieldResourceArray: Array<string> = [];
    private flowFieldTextureInfo: Array<number> = []; 
    private seedingTextureSize = [0.0, 0.0];
    private seedingResourceArray: Array<string> = [];
    private seedingTextureInfo: Array<number> = [];

    private flowfieldTextureArray = [0.0, 0.0, 0.0];
    private seedingTextureArray = [0.0, 0.0, 0.0];

    private uboMapBuffer: Float32Array;
    private flowBoundary: Array<number>;
    private textureArraySize = 0;
    

    public beginBlock = -1.0;
    public trajectoryNum = 262144;
    public segmentNum = 16;
    public maxSegmentNum = 0;
    public maxTrajectoryNum = this.trajectoryNum;
    public _progressRate = 0.0;
    public speedFactor = 2.0;
    public dropRate = 0.003;
    public dropRateBump = 0.001;
    public fillWidth = 1.0;
    public aaWidth = 1.0;
    public isUnsteady = true;
    public isSuspended = false
    public isPaused = false; // 新增：动画暂停状态
    public particleMapBuffer: Float32Array | null = null;

    // Member for rendering
    private renderVAO: WebGLVertexArrayObject = 0;
    private renderVAO2: WebGLVertexArrayObject = 0;
    private rVAO: WebGLVertexArrayObject = 0;

    private trajectoryShader: Shader | null = null;
    private pointShader: Shader | null = null;
    private poolShader: Shader | null = null;
    private maskShader: Shader | null = null;

    private maxBlockColumn: number = 0;
    private textureOffsetArray: Array<TextureOffset>;

    private projTextureInfo = 0.0;
    private trajectoryPool = 0;

    public segmentPrepare = 0;

    // 多边形遮罩相关属性
    private maskBuffer: WebGLBuffer | null = null;
    private maskVAO: WebGLVertexArrayObject | null = null;
    private polygonVertices: number[] = [];


    constructor(
        id: string, renderingMode: '2d' | '3d',
        ffManager: DirectFlowFieldHost
    ) {
        super(id, renderingMode);

        this.ffManager = ffManager;
        this.maxBlockSize = 0.0;
        this.maxBlockColumn = 0.0;
        this.textureOffsetArray = [];
        this.flowBoundary = [];
        this.uboMapBuffer = new Float32Array(12);
    }

    private rc: WebGL2RenderingContext | null = null;

    async Prepare(gl: WebGL2RenderingContext) {
        this.rc = gl;
        renderContextSetting(gl);

        const f32TextureViewInfo: TextureViewInfo = {
            textureDataInfo: {
                target: gl.TEXTURE_2D, 
                flip: true,
                format: stf.R32G32_SFLOAT},
            viewType: gl.TEXTURE_2D,
            format: stf.R32G32_SFLOAT
        };
        const textureViewInfo: TextureViewInfo = {
            textureDataInfo: {
                target: gl.TEXTURE_2D, 
                flip: true,
                format: stf.R8G8B8A8_UBYTE},
            viewType: gl.TEXTURE_2D,
            format: stf.R8G8B8A8_UBYTE
        };
        const nSampler = stm.AddSampler({
            magFilter: gl.NEAREST,
            minFilter: gl.NEAREST,
            addressModeU: gl.CLAMP_TO_EDGE,
            addressModeV: gl.CLAMP_TO_EDGE
        });
        const lSampler = stm.AddSampler({
            magFilter: gl.LINEAR,
            minFilter: gl.LINEAR,
            addressModeU: gl.CLAMP_TO_EDGE,
            addressModeV: gl.CLAMP_TO_EDGE
        });

        // Get boundaries of flow speed
        this.flowBoundary = this.ffManager.parser.flowBoundary;
        this.maxTrajectoryNum = this.ffManager.parser.maxTrajectoryNum;
        this.segmentNum = this.ffManager.parser.maxSegmentNum;
        this.maxSegmentNum = this.ffManager.parser.maxSegmentNum;
        this.segmentPrepare = this.ffManager.parser.maxSegmentNum;
        this.maxBlockSize = Math.ceil(Math.sqrt(this.maxTrajectoryNum));
        this.flowFieldTextureSize = this.ffManager.parser.flowFieldTextureSize;
        this.seedingTextureSize = this.ffManager.parser.seedingTextureSize;

        // Set uniform buffer object data (something will not change)
        this.uboMapBuffer[8] = this.flowBoundary[0];
        this.uboMapBuffer[9] = this.flowBoundary[1];
        this.uboMapBuffer[10] = this.flowBoundary[2];
        this.uboMapBuffer[11] = this.flowBoundary[3];

        // Arrays of resource urls
        this.flowFieldResourceArray = this.ffManager.parser.flowFieldResourceArray;
        this.seedingResourceArray = this.ffManager.parser.seedingResourceArray;

        this.phaseCount = this.flowFieldResourceArray.length; // the last one is a phase from the end to the head
        this.timeLast = this.phaseCount * 150; // 150 frame per timePoint
        this.textureArraySize = Math.min(3, Math.max(1, this.phaseCount));
        for (let i = 0; i < this.textureArraySize; i++) {
            
            // Load textures of flow fields
            const fID = stm.SetTexture(stm.AddTextureView(f32TextureViewInfo), lSampler);
            this.flowfieldTextureArray[i] = fID;
            await stm.FillTextureDataByImage(fID, 0, this.flowFieldResourceArray[i], this.flowFieldTextureSize[0], this.flowFieldTextureSize[1]);

            // Load textures of seeding masks
            const sID = stm.SetTexture(stm.AddTextureView(textureViewInfo), nSampler);
            this.seedingTextureArray[i] = sID;
            await stm.FillTextureDataByImage(sID, 0, this.seedingResourceArray[i], this.seedingTextureSize[0], this.seedingTextureSize[1]);
        }

        // Load texture of transform
        const tID = stm.SetTexture(stm.AddTextureView(f32TextureViewInfo), lSampler);
        await stm.FillTextureDataByImage(tID, 0, this.ffManager.parser.transform2DResource, this.ffManager.parser.transformTextureSize[0], this.ffManager.parser.transformTextureSize[1]);
        this.projTextureInfo = tID;

        // Set data of particle block used to fill simulation buffer and particle pool texture
        this.particleMapBuffer = new Float32Array(this.maxBlockSize * this.maxBlockSize * 3).fill(0);
        for (let i = 0; i < this.maxTrajectoryNum; i++) {
            this.particleMapBuffer[i * 3 + 0] = rand(0, 1.0);
            this.particleMapBuffer[i * 3 + 1] = rand(0, 1.0);
            this.particleMapBuffer[i * 3 + 2] = 0.0;
        }

        // Set life for particles
        const particleCountdownArray = new Float32Array(this.maxTrajectoryNum);
        for (let i = 0; i < this.maxTrajectoryNum; i++) {
            particleCountdownArray[i] = this.maxSegmentNum * 9.0;
        }

        // Set Buffer used to simulation
        this.simulationBuffer = makeBufferBySource(gl, gl.ARRAY_BUFFER, this.particleMapBuffer, gl.DYNAMIC_DRAW)!;
        this.xfSimulationBuffer = makeBufferBySource(gl, gl.ARRAY_BUFFER, this.particleMapBuffer, gl.DYNAMIC_DRAW)!;
        this.lifeBuffer = makeBufferBySource(gl, gl.ARRAY_BUFFER, particleCountdownArray, gl.DYNAMIC_DRAW)!;
        this.xfLifeBuffer = makeBufferBySource(gl, gl.ARRAY_BUFFER, particleCountdownArray, gl.DYNAMIC_DRAW)!;

        // Make uniform buffer object
        this.UBO = makeBufferBySize(gl, gl.ARRAY_BUFFER, 48, gl.DYNAMIC_DRAW)!;

        // Set Vertex Array Object
        this.simulationVAO = gl.createVertexArray()!;
        gl.bindVertexArray(this.simulationVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.simulationBuffer);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 1 * 4, 0);
        gl.enableVertexAttribArray(1);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.simulationVAO2 = gl.createVertexArray()!;
        gl.bindVertexArray(this.simulationVAO2);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.xfSimulationBuffer);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.xfLifeBuffer);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 1 * 4, 0);
        gl.enableVertexAttribArray(1);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.renderVAO = gl.createVertexArray()!;
        gl.bindVertexArray(this.renderVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer);
        gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 1 * 4, 0);
        gl.vertexAttribDivisor(0, 1);
        gl.enableVertexAttribArray(0);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.renderVAO2 = gl.createVertexArray()!;
        gl.bindVertexArray(this.renderVAO2);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.xfLifeBuffer);
        gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 1 * 4, 0);
        gl.vertexAttribDivisor(0, 1);
        gl.enableVertexAttribArray(0);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Set Transform Feedback Object
        this.XFBO = gl.createTransformFeedback()!;
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.XFBO);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.xfSimulationBuffer);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.xfSimulationBuffer, 0, this.maxBlockSize * this.maxBlockSize * 12);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.xfLifeBuffer);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.xfLifeBuffer, 0, this.maxBlockSize * this.maxBlockSize * 4);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

        this.XFBO2 = gl.createTransformFeedback()!;
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.XFBO2);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.simulationBuffer);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.simulationBuffer, 0, this.maxBlockSize * this.maxBlockSize * 12);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, this.lifeBuffer);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.lifeBuffer, 0, this.maxBlockSize * this.maxBlockSize * 4);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

        // Prepare descriptive variables
        const MAX_TEXTURE_SIZE = this.ffManager.controller!.constraints["MAX_TEXTURE_SIZE"];
        const MAX_STREAMLINE_NUM = this.ffManager.controller!.constraints["MAX_STREAMLINE_NUM"];
        const MAX_SEGMENT_NUM = this.ffManager.controller!.constraints["MAX_SEGMENT_NUM"];

        this.maxBlockSize = Math.ceil(Math.sqrt(MAX_STREAMLINE_NUM))
        this.maxBlockColumn =  Math.floor(MAX_TEXTURE_SIZE / this.maxBlockSize);
        for (let i = 0; i < MAX_SEGMENT_NUM; i++) {
            const offset: TextureOffset = {
                offsetX: (i % this.maxBlockColumn) * this.maxBlockSize,
                offsetY: Math.floor(i / this.maxBlockColumn) * this.maxBlockSize
            };

            this.textureOffsetArray.push(offset);
        }

        // Set data of particle block used to fill simulation buffer and particle pool texture
        this.particleMapBuffer = new Float32Array(this.maxBlockSize * this.maxBlockSize * 3).fill(0);

        // Make uniform buffer object
        this.UBO = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.UBO);
        gl.bufferData(gl.ARRAY_BUFFER, 48, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Set particle pool
        const tv = stm.AddTextureView({
            textureDataInfo: {
                target: gl.TEXTURE_2D, 
                flip: false,
                width: MAX_TEXTURE_SIZE,
                height: MAX_TEXTURE_SIZE,
                format: stf.R32G32B32_SFLOAT
            },
            viewType: gl.TEXTURE_2D,
            format: stf.R32G32B32_SFLOAT
        });
        this.trajectoryPool = stm.SetTexture(tv, nSampler);

        for (let i = 0; i < MAX_SEGMENT_NUM; i++) {
            stm.UpdateDataBySource(this.trajectoryPool, 0, this.textureOffsetArray[i].offsetX, this.textureOffsetArray[i].offsetY, this.maxBlockSize, this.maxBlockSize, this.particleMapBuffer);
        }

        // Build Shaders
        this.updateShader = loadShaderSource(gl, "update", updateVert, updateFrag, ['newInfo', 'aliveTime'])!;
        this.trajectoryShader = loadShaderSource(gl, "draw", trajectoryVert, trajectoryFrag);
        this.pointShader = loadShaderSource(gl, "draw", pointVert, pointFrag);
        this.poolShader = loadShaderSource(gl, "textureDebug", poolVert, poolFrag);

        // 初始化遮罩相关资源
        this.initMaskBuffer(gl);
        this.maskShader = loadShaderSource(gl, "mask", maskVert, maskFrag);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
        gl.bindVertexArray(null);

        this.progressRate = 0;

        return true;
    }

    GPUMemoryUpdate(_beginBlock: number, _trajectoryBlock: Float32Array, _aliveLineNum: number, _trajectoryBuffer: Float32Array) {

    }

    bindUBO(gl: WebGL2RenderingContext, bindingPointIndex: number) {

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.UBO);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uboMapBuffer);
        gl.bindBufferRange(gl.UNIFORM_BUFFER, bindingPointIndex, this.UBO, 0, this.uboMapBuffer.length * 4.0);
    } 
    
    resourceLoad(texturePoint: number, timePoint: number) {
        // console.log(timePoint % this.flowFieldResourceArray.length)
        stm.UpdateDataByImage(this.flowfieldTextureArray[texturePoint], this.flowFieldResourceArray[timePoint], 0);
        stm.UpdateDataByImage(this.seedingTextureArray[texturePoint], this.seedingResourceArray[timePoint], 0);
    }

    set timeCount(value: number) {
        this._timeCount = value % this.timeLast;
    }

    get timeCount() {
        return this._timeCount;
    }

    set progressRate(value: number) {

        const lastPhase = Math.floor(this._progressRate * this.phaseCount);
        const currentPhase =  Math.floor(value * this.phaseCount) % this.phaseCount;
        const nextPhase = (currentPhase + 1) % this.phaseCount;

        this._progressRate = value;

        this.flowFieldTextureInfo = this.getFieldTextures();
        this.seedingTextureInfo = this.getMaskTextures();
        this.uboMapBuffer[0] = this.getProgressBetweenTexture();
        this.ffManager.onFlowProgressUpdate?.({
            progressRate: this._progressRate,
            currentPhase,
            nextPhase,
            phaseMix: this.uboMapBuffer[0],
            phaseCount: this.phaseCount,
        } as FlowProgressState);
        
        // Update texture for next nextPhase
        if (currentPhase != lastPhase) {
            this.resourceLoad((currentPhase + 2) % this.textureArraySize, (currentPhase + 2) % this.phaseCount);
        }

    }

    get progressRate() {
        return this._progressRate;
    }

    getFieldTextures() {

        const currentPhase = Math.floor(this.progressRate * this.phaseCount);
        const nextPhase = (currentPhase + 1) % this.phaseCount;
        return [this.flowfieldTextureArray[currentPhase % this.textureArraySize], this.flowfieldTextureArray[nextPhase % this.textureArraySize]];
    }

    getMaskTextures() {

        const currentPhase = Math.floor(this.progressRate * this.phaseCount);
        const nextPhase = (currentPhase + 1) % this.phaseCount;
        return [this.seedingTextureArray[currentPhase % this.textureArraySize], this.seedingTextureArray[nextPhase % this.textureArraySize]];
    }

    getProgressBetweenTexture() {

        const progress = this.progressRate * this.phaseCount;
        return progress - Math.floor(progress);
    }

    async swap() {

        if (this.beginBlock % 2 == 0)
        {
            this.sVAO = this.simulationVAO;
            this.rVAO = this.renderVAO;
            this.xfBO = this.XFBO;
            this.unPackBuffer = this.simulationBuffer;
        } else {
            this.sVAO = this.simulationVAO2;
            this.rVAO = this.renderVAO2;
            this.xfBO = this.XFBO2;
            this.unPackBuffer = this.xfSimulationBuffer;
        }
    }

    tickLogicCount() {

        this.trajectoryNum = this.ffManager.controller!.lineNum;
        this.segmentNum = this.ffManager.controller!.segmentNum;
        this.isUnsteady = this.ffManager.controller!.isUnsteady;
        this.dropRate = this.ffManager.controller!.dropRate;
        this.dropRateBump = this.ffManager.controller!.dropRateBump;
        this.speedFactor = this.ffManager.controller!.speedFactor;

        // 暂停时不更新粒子位置和时间
        if (!this.isPaused) {
            this.beginBlock = (this.beginBlock + 1) % this.ffManager.controller!.constraints["MAX_SEGMENT_NUM"];
            this.swap();

            if (this.isUnsteady && (!stm.IsBusy())) {
                this.progressRate = this.timeCount / this.timeLast;
                this.timeCount = this.timeCount + 1;
            }
        }

        this.uboMapBuffer[1] = this.maxSegmentNum;
        this.uboMapBuffer[2] = this.maxSegmentNum * 10;
        this.uboMapBuffer[3] = this.dropRate;
        this.uboMapBuffer[4] = this.dropRateBump;
        this.uboMapBuffer[5] = this.speedFactor * 0.01 * 100;
        this.uboMapBuffer[6] = this.ffManager.controller!.colorScheme;
    }

    tickRender(gl: WebGL2RenderingContext, u_matrix: number[]) {
        // 检查着色器是否加载成功
        if (!this.checkShadersLoaded()) {
            return;
        }

        // 首先渲染遮罩到模板缓冲区
        if (this.polygonVertices.length > 0) {
            console.log("FlowLayer_noWorker.tickRender: 正在应用多边形遮罩，顶点数:", this.polygonVertices.length / 2);
            this.renderMask(gl, u_matrix);
        } else {
            // console.log("FlowLayer_noWorker.tickRender: 没有多边形数据，跳过遮罩渲染");
        }

        this.bindUBO(gl, 0);

        // Pass 1: Simulation
        gl.bindVertexArray(this.sVAO);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.xfBO);
        stm.BindTexture([this.flowFieldTextureInfo[0], this.flowFieldTextureInfo[1], this.seedingTextureInfo[0], this.seedingTextureInfo[1]], [0, 1, 2, 3]);

        this.updateShader!.use();
        this.updateShader!.setVec1i("flowField", [0, 1]);
        this.updateShader!.setVec1i("mask", [2, 3]);
        this.updateShader!.setFloat("randomSeed", Math.random());
        this.updateShader!.setUniformBlock("FlowFieldUniforms", 0);

        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.trajectoryNum);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);

        gl.bindVertexArray(null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // Pass 2: Update particle pool
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, this.unPackBuffer);
        stm.UpdateDataByBuffer(this.trajectoryPool, 0, this.textureOffsetArray[this.beginBlock].offsetX, this.textureOffsetArray[this.beginBlock].offsetY, this.maxBlockSize, this.maxBlockSize);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
        gl.finish();

        // Preparing for right results
        if (this.segmentPrepare > 0) {
            this.segmentPrepare --;
            return;
        }

        // Pass 3: Rendering by trajectorires or points
        gl.bindVertexArray(this.rVAO);
        stm.BindTexture([this.trajectoryPool, this.projTextureInfo], [0, 1]);

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendColor(0.0, 0.0, 0.0, 0.0);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        if (this.ffManager.controller!.primitive == 0) {
            this.trajectoryShader!.use();
            this.trajectoryShader!.setInt("particlePool", 0);
            this.trajectoryShader!.setInt("projectionTexture", 1);
            this.trajectoryShader!.setInt("blockNum", this.ffManager.controller!.constraints["MAX_SEGMENT_NUM"]);
            this.trajectoryShader!.setInt("beginBlock", this.beginBlock);
            this.trajectoryShader!.setInt("blockSize", this.maxBlockSize);
            this.trajectoryShader!.setFloat("currentSegmentNum", this.segmentNum);
            this.trajectoryShader!.setFloat("fillWidth", this.ffManager.controller!.fillWidth);
            this.trajectoryShader!.setFloat("aaWidth", this.ffManager.controller!.aaWidth);
            this.trajectoryShader!.setFloat2("viewport", gl.canvas.width, gl.canvas.height);
            this.trajectoryShader!.setMat4("u_matrix", u_matrix);
            this.trajectoryShader!.setUniformBlock("FlowFieldUniforms", 0);

            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (this.segmentNum - 1) * 2, this.trajectoryNum);
        }
        else {
            this.pointShader!.use();
            this.pointShader!.setInt("particlePool", 0);
            this.pointShader!.setInt("projectionTexture", 1);
            this.pointShader!.setInt("blockNum", this.ffManager.controller!.constraints["MAX_SEGMENT_NUM"]);
            this.pointShader!.setInt("beginBlock", this.beginBlock);
            this.pointShader!.setInt("blockSize", this.maxBlockSize);
            this.pointShader!.setFloat("fillWidth", this.ffManager.controller!.fillWidth);
            this.pointShader!.setFloat("aaWidth", this.ffManager.controller!.aaWidth);
            this.pointShader!.setFloat2("viewport", gl.canvas.width, gl.canvas.height);
            this.pointShader!.setMat4("u_matrix", u_matrix);
            this.pointShader!.setUniformBlock("FlowFieldUniforms", 0);

            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.trajectoryNum);
        }

        gl.disable(gl.BLEND);
        
        // === 清理 stencil 状态 ===
        if (this.polygonVertices.length > 0) {
            // 重要：彻底清理模板测试状态，防止影响Mapbox后续图层
            gl.stencilMask(0xFF); // 允许写入模板缓冲区
            gl.clear(gl.STENCIL_BUFFER_BIT); // 清空模板缓冲区
            gl.stencilFunc(gl.ALWAYS, 0, 0xFF); // 重置模板测试函数
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); // 重置模板操作
            gl.disable(gl.STENCIL_TEST); // 禁用模板测试
            
            console.log("已清理模板测试状态");
            
            // 重置 Mapbox stencil 状态
            if (this.map && (this.map as any).painter && typeof (this.map as any).painter.resetStencilClippingMasks === 'function') {
                (this.map as any).painter.resetStencilClippingMasks();
            }
        }

        // === 清理其他状态（防止影响 Mapbox 后续图层）===
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    debug(gl: WebGL2RenderingContext) {

        // Show particle pool
        if (this.ffManager.controller!.content == "particle pool") {

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            this.poolShader!.use();
            stm.BindTexture([this.trajectoryPool], [0]);
            this.poolShader!.setFloat2("viewport", window.innerWidth, window.innerHeight);
            this.poolShader!.setInt("textureBuffer", 0);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
            gl.disable(gl.BLEND);
        }
    }

    async onAdd(map: Map, gl: WebGL2RenderingContext) {
        console.log("Custom flow field layer is being added...");
        this.map = map;
        this.ffManager.platform = map;

        // 确保此图层添加到最上层
        if (map.getStyle() && map.getStyle().layers) {
            const topLayerId = map.getStyle().layers[map.getStyle().layers.length - 1].id;
            map.moveLayer(this.id, topLayerId);
        }

        renderContextSetting(gl);
        this.ready = await this.Prepare(gl);
    }

    render(gl: WebGL2RenderingContext, u_matrix: number[]) {
        // 在渲染开始时重置模板缓冲区，防止污染Mapbox stencil
        if (this.map && (this.map as any).painter && typeof (this.map as any).painter.resetStencilClippingMasks === 'function') {
            (this.map as any).painter.resetStencilClippingMasks();
        }
        
        if (!this.visible) {
            return;
        }

        if(!this.ready) {
            console.log("manager not ready !");
            this.map?.triggerRepaint();
            return;
        }

        // 检查动画是否暂停
        if (this.isPaused) {
            // 暂停时：仍然渲染当前帧，但不更新粒子位置
            this.tickRender(gl, u_matrix);
        } else {
            // 正常播放：更新并渲染
            this.tickLogicCount();
            this.tickRender(gl, u_matrix);
        }
        this.map?.triggerRepaint();

        if (this.ffManager.debug) {
            this.ffManager.stats?.update();
            this.debug(gl);
        }
    }

    onRemove(_map: Map, gl: WebGL2RenderingContext): void {
        gl.deleteVertexArray(this.renderVAO);
        gl.deleteBuffer(this.UBO);
        stm.Empty();
        this.poolShader!.delete();
        this.pointShader!.delete();
        this.trajectoryShader!.delete();
        if (this.maskShader) this.maskShader.delete();
        if (this.maskBuffer) gl.deleteBuffer(this.maskBuffer);
        if (this.maskVAO) gl.deleteVertexArray(this.maskVAO);
    }

    // 初始化多边形遮罩
    private initMaskBuffer(gl: WebGL2RenderingContext) {
        // 创建多边形顶点缓冲区
        this.maskBuffer = gl.createBuffer();
        this.maskVAO = gl.createVertexArray();
        gl.bindVertexArray(this.maskVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.maskBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // 更新多边形顶点数据
    public updatePolygon(vertices: number[]) {
        console.log("FlowLayer_noWorker: 更新多边形顶点 (归一化坐标)");
        
        // 检查顶点数组长度是否为偶数
        if (vertices.length % 2 !== 0) {
            console.error("错误：顶点数组长度必须是偶数 (x,y对)，当前长度:", vertices.length);
            return;
        }
        
        // 处理顶点数据，确保每个顶点有正确的格式
        const processedVertices = [];
        for (let i = 0; i < vertices.length; i += 2) {
            const x = vertices[i];
            const y = vertices[i + 1];
            
            // 跳过无效数据
            if (isNaN(x) || !isFinite(x) || isNaN(y) || !isFinite(y)) {
                console.warn(`跳过无效顶点 ${i/2}:`, x, y);
                continue;
            }
            
            processedVertices.push(x);
            processedVertices.push(y);
            console.log(`  顶点 ${processedVertices.length/2 - 1}: (${x.toFixed(4)}, ${y.toFixed(4)})`);
        }
        
        // 确保有足够的顶点形成多边形
        if (processedVertices.length < 6) { // 至少3个顶点 (6个坐标值)
            console.error("错误：处理后的有效顶点不足以形成多边形，需要至少3个顶点");
            return;
        }
        
        // 确保首尾顶点相同，形成闭合多边形
        const lastIndex = processedVertices.length - 2;
        if (processedVertices[0] !== processedVertices[lastIndex] || 
            processedVertices[1] !== processedVertices[lastIndex + 1]) {
            // 添加首顶点到末尾，闭合多边形
            processedVertices.push(processedVertices[0]);
            processedVertices.push(processedVertices[1]);
            console.log("自动闭合多边形，添加首顶点到末尾");
        }
        
        this.polygonVertices = processedVertices;
        console.log("处理后的多边形顶点数:", this.polygonVertices.length / 2);
        
        if (this.rc && this.maskBuffer) {
            console.log("FlowLayer_noWorker: 更新GPU缓冲区，顶点数:", this.polygonVertices.length / 2);
            
            // 验证顶点数据是否在有效范围内
            const hasInvalidRange = this.polygonVertices.some(v => v < -0.1 || v > 1.1);
            if (hasInvalidRange) {
                console.warn("警告：顶点坐标超出归一化范围(-0.1~1.1)，可能导致渲染问题");
            }
            
            this.rc.bindBuffer(this.rc.ARRAY_BUFFER, this.maskBuffer);
            this.rc.bufferData(this.rc.ARRAY_BUFFER, new Float32Array(this.polygonVertices), this.rc.STATIC_DRAW);
            
            // 强制重绘以应用新的遮罩
            if (this.map) {
                this.map.triggerRepaint();
            }
        } else {
            console.warn("FlowLayer_noWorker: 无法更新多边形，WebGL上下文或缓冲区未初始化");
            if (!this.rc) console.warn("  - WebGL上下文不可用");
            if (!this.maskBuffer) console.warn("  - 遮罩缓冲区不可用");
        }
    }

    // 渲染多边形遮罩到模板缓冲区
    private renderMask(gl: WebGL2RenderingContext, u_matrix: number[]) {
        if (!this.maskShader) {
            console.warn("FlowLayer_noWorker: 遮罩着色器不可用，无法渲染遮罩");
            return;
        }
        
        if (!this.maskVAO) {
            console.warn("FlowLayer_noWorker: 遮罩顶点数组对象不可用，无法渲染遮罩");
            return;
        }
        
        if (this.polygonVertices.length === 0) {
            console.warn("FlowLayer_noWorker: 多边形顶点数据为空，无法渲染遮罩");
            return;
        }
        
        // 检查顶点数量是否合理 (每个顶点2个坐标值，确保数量是偶数)
        if (this.polygonVertices.length % 2 !== 0) {
            console.warn("FlowLayer_noWorker: 多边形顶点数据格式不正确，坐标数量不是偶数");
            return;
        }
        
        // 检查顶点数据中是否有无效值
        const hasInvalidData = this.polygonVertices.some(v => isNaN(v) || !isFinite(v));
        if (hasInvalidData) {
            console.warn("FlowLayer_noWorker: 多边形顶点数据包含无效值，无法渲染遮罩");
            return;
        }
        
        console.log("FlowLayer_noWorker: 开始渲染多边形遮罩，顶点数:", this.polygonVertices.length / 2);
        
        // 重置 Mapbox 之前帧的 stencil mask 状态
        if (this.map && (this.map as any).painter && typeof (this.map as any).painter.resetStencilClippingMasks === 'function') {
            (this.map as any).painter.resetStencilClippingMasks();
        }
        
        // 初始化 stencil buffer 状态
        gl.enable(gl.STENCIL_TEST);
        gl.clearStencil(0); // stencil 清为 0
        gl.clear(gl.STENCIL_BUFFER_BIT);

        // === 第一步：绘制 stencil 遮罩区域（多边形）===
        // 禁用颜色和深度写入，只写入模板缓冲区
        gl.colorMask(false, false, false, false);
        gl.depthMask(false);
        
        // 设置模板测试函数：总是通过测试，写入值为1
        gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
        gl.stencilMask(0xFF); // 允许写入模板缓冲区
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); // 当深度测试通过时替换模板值
        
        // 渲染多边形到模板缓冲区（值为1的区域表示多边形内部）
        this.maskShader.use();
        gl.bindVertexArray(this.maskVAO);

        // 设置变换矩阵
        this.maskShader.setMat4("u_matrix", u_matrix);

        // 输出多边形顶点坐标，用于调试
        const vertexPairs = [];
        for (let i = 0; i < this.polygonVertices.length; i += 2) {
            vertexPairs.push(`(${this.polygonVertices[i].toFixed(4)}, ${this.polygonVertices[i+1].toFixed(4)})`);
        }
        console.log("多边形顶点坐标 (归一化):", vertexPairs.join(", "));
        
        // 计算多边形边界框，检查是否在可见区域内
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < this.polygonVertices.length; i += 2) {
            const x = this.polygonVertices[i];
            const y = this.polygonVertices[i + 1];
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
        console.log("多边形边界框 (归一化):", 
            "左上:", [minX.toFixed(4), minY.toFixed(4)], 
            "右下:", [maxX.toFixed(4), maxY.toFixed(4)]);
        
        // 检查是否在画布区域内 (0-1范围)
        console.log("归一化范围检查 - 多边形是否在可视区域内:", 
            !(maxX < 0 || minX > 1 || maxY < 0 || minY > 1));
        
        // 渲染多边形到模板缓冲区
        gl.drawArrays(gl.TRIANGLE_FAN, 0, this.polygonVertices.length / 2);
        
        // === 第二步：设置绘制流场时的 stencil 状态 ===
        // 恢复颜色和深度写入
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        
        // 设置模板测试函数：只有当模板值等于1时（多边形内部）才通过测试
        gl.stencilFunc(gl.EQUAL, 1, 0xFF);
        gl.stencilMask(0x00); // 禁止写入模板缓冲区
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); // 保持模板值不变
    }

    // 检查着色器是否加载成功
    private checkShadersLoaded() {
        // 检查更新着色器
        if (!this.updateShader) {
            console.error("更新着色器加载失败");
            return false;
        }
        
        // 检查轨迹着色器
        if (!this.trajectoryShader) {
            console.error("轨迹着色器加载失败");
            return false;
        }
        
        // 检查点着色器
        if (!this.pointShader) {
            console.error("点着色器加载失败");
            return false;
        }
        
        // 检查遮罩着色器（如果启用了多边形遮罩）
        if (this.polygonVertices.length > 0 && !this.maskShader) {
            console.error("遮罩着色器加载失败");
            return false;
        }
        
        return true;
    }

    // 播放动画
    public play() {
        console.log("FlowLayer_Direct: 播放动画，isPaused设置为false");
        this.isPaused = false;
    }

    // 暂停动画
    public pause() {
        console.log("FlowLayer_Direct: 暂停动画，isPaused设置为true，粒子将停留在当前位置");
        this.isPaused = true;
    }

    // 切换播放/暂停状态
    public toggle() {
        if (this.isPaused) {
            this.play();
        } else {
            this.pause();
        }
    }
}


export {
    FlowLayer_Direct
}
