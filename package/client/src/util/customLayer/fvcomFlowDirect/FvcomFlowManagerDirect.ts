import type { Map } from 'mapbox-gl';
import { DescriptionParser, type FvcomTextureSet } from './DescriptionParser';
import { FlowFieldController, type FlowFieldConstraints } from './FlowFieldController';
import type { DirectFlowFieldHost, FlowProgressState } from './types';

export class FvcomFlowManagerDirect implements DirectFlowFieldHost {
    public parser: DescriptionParser;
    public controller: FlowFieldController;
    public debug = false;
    public stats: { update(): void } | null = null;
    public platform: Map | null = null;

    constructor(textureSet: FvcomTextureSet) {
        this.parser = new DescriptionParser(textureSet);
        this.controller = new FlowFieldController();
    }

    static async Create(textureSet: FvcomTextureSet) {
        const manager = new FvcomFlowManagerDirect(textureSet);
        await manager.init();
        return manager;
    }

    async init() {
        await this.parser.Parsing();

        const constraints: FlowFieldConstraints = {
            MAX_TEXTURE_SIZE: this.parser.maxTextureSize,
            MAX_STREAMLINE_NUM: this.parser.maxTrajectoryNum,
            MAX_SEGMENT_NUM: this.parser.maxSegmentNum,
            MAX_DORP_RATE: this.parser.maxDropRate,
            MAX_DORP_RATE_BUMP: this.parser.maxDropRateBump,
        };

        this.controller = new FlowFieldController(constraints);
        this.controller.platform = 'mapbox no worker';
        this.controller.lineNum = this.parser.maxTrajectoryNum/10;
        this.controller.segmentNum = this.parser.maxSegmentNum;
        this.controller.fullLife = this.parser.maxSegmentNum * 10;
        this.controller.speedFactor = 2.0;
        this.controller.dropRate = 0.003;
        this.controller.dropRateBump = 0.001;
        this.controller.fillWidth = 1.0;
        this.controller.aaWidth = 2.0;
        this.controller.colorScheme = 0;
        this.controller.primitive = 0;
    }

    onFlowProgressUpdate(_state: FlowProgressState) {}

    destroy() {
        this.parser.destroy();
    }
}

export type { FvcomTextureSet };
