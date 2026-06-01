import type { Map } from 'mapbox-gl';
import type { DescriptionParser } from './DescriptionParser';
import type { FlowFieldController } from './FlowFieldController';

export interface FlowProgressState {
    progressRate: number;
    currentPhase: number;
    nextPhase: number;
    phaseMix: number;
    phaseCount: number;
}

export interface DirectFlowFieldHost {
    parser: DescriptionParser;
    controller: FlowFieldController;
    debug: boolean;
    stats?: { update(): void } | null;
    platform?: Map | null;
    onFlowProgressUpdate?(state: FlowProgressState): void;
}
