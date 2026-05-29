import { Map } from 'mapbox-gl'
import { CustomLayer } from './cusLayer'
import { FvcomFlowManager } from './fvcomFlowManager'

export class FvcomFlowLayer extends CustomLayer {
    private map: mapboxgl.Map | null = null
    private ready = false
    public visible = true
    public meshVisible = true

    constructor(
        id: string,
        renderingMode: '2d' | '3d',
        public flowManager: FvcomFlowManager,
    ) {
        super(id, renderingMode)
    }

    onAdd(map: Map, gl: WebGL2RenderingContext) {
        this.map = map
        this.flowManager.prepare(gl, map).then((ok) => {
            this.ready = ok
        })
    }

    render(gl: WebGL2RenderingContext, uMatrix: number[]) {
        if (!this.ready) {
            return
        }

        this.flowManager.uMatrix = uMatrix

        // Render mesh overlay if visible
        if (this.meshVisible) {
            this.flowManager.renderMesh(gl)
        }

        // Render flow field if visible
        if (this.visible) {
            const zoom = this.map!.getZoom()
            const maxZoom = this.map!.getMaxZoom()
            this.flowManager.zoomRate = zoom / maxZoom
            if (this.flowManager.zoomRate <= 0.3) {
                this.flowManager.zoomRate = 10.0 / (3.0 * this.flowManager.zoomRate)
            } else if (this.flowManager.zoomRate <= 0.7) {
                this.flowManager.zoomRate = 1.0
            } else {
                this.flowManager.zoomRate = -10.0 / (3.0 * this.flowManager.zoomRate) + 10.0 / 3.0
            }

            this.flowManager.tick()
            this.flowManager.render(gl)
        }

        this.map?.triggerRepaint()
    }
}
