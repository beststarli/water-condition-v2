export interface FvcomTextureSet {
    uvTexture1: string;
    uvTexture2?: string;
    meshTexture1: string;
    meshTexture2?: string;
    seedTexture?: string;
    bounds: [number, number, number, number];
}

type TextureImageInfo = {
    image: HTMLImageElement;
    logicalWidth: number;
    height: number;
};

const DEFAULT_MAX_TEXTURE_SIZE = 4096;
const DEFAULT_MAX_STREAMLINE_NUM = 262144;
const DEFAULT_MAX_SEGMENT_NUM = 64;
const DEFAULT_MAX_DROP_RATE = 0.1;
const DEFAULT_MAX_DROP_RATE_BUMP = 0.2;

export class DescriptionParser {
    public raw: FvcomTextureSet | null = null;
    public flowFieldResourceArray: string[] = [];
    public seedingResourceArray: string[] = [];
    public transform2DResource = "";
    public maxDropRate = DEFAULT_MAX_DROP_RATE;
    public maxDropRateBump = DEFAULT_MAX_DROP_RATE_BUMP;
    public maxSegmentNum = DEFAULT_MAX_SEGMENT_NUM;
    public maxTrajectoryNum = DEFAULT_MAX_STREAMLINE_NUM;
    public maxTextureSize = DEFAULT_MAX_TEXTURE_SIZE;
    public extent = [0.0, 0.0, 0.0, 0.0];
    public flowBoundary = [0.0, 0.0, 0.0, 0.0];
    public flowFieldTextureSize = [0.0, 0.0];
    public seedingTextureSize = [0.0, 0.0];
    public transformTextureSize = [0.0, 0.0];

    private generatedUrls: string[] = [];

    constructor(private textureSet: FvcomTextureSet) {}

    async Parsing() {
        this.raw = this.textureSet;

        const flowUrls = [this.textureSet.uvTexture1, this.textureSet.uvTexture2].filter(Boolean) as string[];
        const firstFlow = await this.loadFlowTextureInfo(flowUrls[0]);
        const projection = await this.loadRawFloatTextureInfo(this.textureSet.meshTexture1);

        this.flowFieldResourceArray = flowUrls;
        this.flowFieldTextureSize = [firstFlow.logicalWidth, firstFlow.height];
        this.transform2DResource = this.textureSet.meshTexture1;
        this.transformTextureSize = [projection.logicalWidth, projection.height];
        this.extent = [...this.textureSet.bounds];
        this.flowBoundary = this.scanFlowBoundary(firstFlow.image);

        if (this.textureSet.seedTexture) {
            const seedImage = await this.loadImage(this.textureSet.seedTexture);
            this.seedingTextureSize = [seedImage.width, seedImage.height];
            this.seedingResourceArray = flowUrls.map(() => this.textureSet.seedTexture!);
        } else {
            const seedUrls = await Promise.all(flowUrls.map((url) => this.createSeedUrl(url)));
            this.seedingTextureSize = [firstFlow.logicalWidth, firstFlow.height];
            this.seedingResourceArray = seedUrls;
        }

        this.maxTrajectoryNum = Math.min(DEFAULT_MAX_STREAMLINE_NUM, firstFlow.logicalWidth * firstFlow.height);
        this.maxSegmentNum = DEFAULT_MAX_SEGMENT_NUM;
    }

    destroy() {
        this.generatedUrls.forEach((url) => URL.revokeObjectURL(url));
        this.generatedUrls = [];
    }

    private async createSeedUrl(flowUrl: string) {
        const info = await this.loadFlowTextureInfo(flowUrl);
        const validCoords: Array<[number, number]> = [];
        const { data } = this.readImageData(info.image);
        const view = new DataView(data.buffer);
        const physicalWidth = info.image.width;

        for (let canvasY = 0; canvasY < info.height; canvasY += 1) {
            const textureY = info.height - 1 - canvasY;
            for (let x = 0; x < info.logicalWidth; x += 1) {
                const uOffset = (canvasY * physicalWidth + x) * 4;
                const vOffset = (canvasY * physicalWidth + info.logicalWidth + x) * 4;
                const u = view.getFloat32(uOffset, true);
                const v = view.getFloat32(vOffset, true);
                if (Number.isFinite(u) && Number.isFinite(v) && u > -99998 && v > -99998) {
                    validCoords.push([x, textureY]);
                }
            }
        }

        if (validCoords.length === 0) {
            for (let y = 0; y < info.height; y += 1) {
                for (let x = 0; x < info.logicalWidth; x += 1) {
                    validCoords.push([x, y]);
                }
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = info.logicalWidth;
        canvas.height = info.height;
        const ctx = canvas.getContext('2d')!;
        const seedImageData = ctx.createImageData(info.logicalWidth, info.height);

        for (let canvasY = 0; canvasY < info.height; canvasY += 1) {
            const textureY = info.height - 1 - canvasY;
            for (let x = 0; x < info.logicalWidth; x += 1) {
                const uOffset = (canvasY * physicalWidth + x) * 4;
                const vOffset = (canvasY * physicalWidth + info.logicalWidth + x) * 4;
                const u = view.getFloat32(uOffset, true);
                const v = view.getFloat32(vOffset, true);
                const valid = Number.isFinite(u) && Number.isFinite(v) && u > -99998 && v > -99998;
                const fallback = validCoords[(canvasY * info.logicalWidth + x) % validCoords.length];
                const [seedX, seedY] = valid ? [x, textureY] : fallback;
                const index = (canvasY * info.logicalWidth + x) * 4;
                seedImageData.data[index] = (seedX >> 8) & 0xff;
                seedImageData.data[index + 1] = seedX & 0xff;
                seedImageData.data[index + 2] = (seedY >> 8) & 0xff;
                seedImageData.data[index + 3] = seedY & 0xff;
            }
        }

        ctx.putImageData(seedImageData, 0, 0);
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Failed to create FVCOM seed texture.')), 'image/png');
        });
        const url = URL.createObjectURL(blob);
        this.generatedUrls.push(url);
        return url;
    }

    private scanFlowBoundary(image: HTMLImageElement) {
        const logicalWidth = image.width / 2;
        const { data } = this.readImageData(image);
        const view = new DataView(data.buffer);
        let minU = Infinity;
        let minV = Infinity;
        let maxU = -Infinity;
        let maxV = -Infinity;

        for (let y = 0; y < image.height; y += 1) {
            for (let x = 0; x < logicalWidth; x += 1) {
                const uOffset = (y * image.width + x) * 4;
                const vOffset = (y * image.width + logicalWidth + x) * 4;
                const u = view.getFloat32(uOffset, true);
                const v = view.getFloat32(vOffset, true);
                if (Number.isFinite(u) && Number.isFinite(v) && u > -99998 && v > -99998) {
                    minU = Math.min(minU, u);
                    minV = Math.min(minV, v);
                    maxU = Math.max(maxU, u);
                    maxV = Math.max(maxV, v);
                }
            }
        }

        if (!Number.isFinite(minU) || !Number.isFinite(minV) || maxU <= minU || maxV <= minV) {
            return [-1.0, -1.0, 1.0, 1.0];
        }

        return [minU, minV, maxU, maxV];
    }

    private readImageData(image: HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, image.width, image.height);
    }

    private async loadFlowTextureInfo(url: string): Promise<TextureImageInfo> {
        const image = await this.loadImage(url);
        return {
            image,
            logicalWidth: Math.floor(image.width / 2),
            height: image.height,
        };
    }

    private async loadRawFloatTextureInfo(url: string): Promise<TextureImageInfo> {
        const image = await this.loadImage(url);
        return {
            image,
            logicalWidth: Math.floor(image.width / 2),
            height: image.height,
        };
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load FVCOM flow texture: ${url}`));
            image.src = url;
        });
    }
}
