import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxLanguage from '@mapbox/mapbox-gl-language'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl-draw/dist/mapbox-gl-draw.css'
// @ts-expect-error no declare file for rectangle mode
import DrawRectangle from 'mapbox-gl-draw-rectangle-mode'
import { useFvcomStore } from '@/store/FvcomStroe'
import { getTexturesAPI } from '@/api/fvcom/fvcom.api'
import { FvcomFlowManager, FvcomTextureSet } from '@/util/customLayer/fvcomFlowManager'
import { FvcomFlowLayer } from '@/util/customLayer/fvcomFlowLayer'
import MiniMap from './MiniMap'

const drawStyles = [
    { 'id': 'gl-draw-polygon-fill-inactive', 'type': 'fill', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], 'paint': { 'fill-color': '#3bb2d0', 'fill-outline-color': '#3bb2d0', 'fill-opacity': 0.1 } },
    { 'id': 'gl-draw-polygon-fill-active', 'type': 'fill', 'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], 'paint': { 'fill-color': '#fbb03b', 'fill-outline-color': '#fbb03b', 'fill-opacity': 0.1 } },
    { 'id': 'gl-draw-polygon-midpoint', 'type': 'circle', 'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], 'paint': { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
    { 'id': 'gl-draw-polygon-stroke-inactive', 'type': 'line', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#3bb2d0', 'line-width': 2 } },
    { 'id': 'gl-draw-polygon-stroke-active', 'type': 'line', 'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#fbb03b', 'line-dasharray': ['literal', [0.2, 2]], 'line-width': 2 } },
    { 'id': 'gl-draw-line-inactive', 'type': 'line', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#3bb2d0', 'line-width': 2 } },
    { 'id': 'gl-draw-line-active', 'type': 'line', 'filter': ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#fbb03b', 'line-dasharray': ['literal', [0.2, 2]], 'line-width': 2 } },
    { 'id': 'gl-draw-polygon-and-line-vertex-stroke-inactive', 'type': 'circle', 'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 5, 'circle-color': '#fff' } },
    { 'id': 'gl-draw-polygon-and-line-vertex-inactive', 'type': 'circle', 'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 3, 'circle-color': '#fbb03b' } },
    { 'id': 'gl-draw-point-point-stroke-inactive', 'type': 'circle', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 5, 'circle-opacity': 1, 'circle-color': '#fff' } },
    { 'id': 'gl-draw-point-inactive', 'type': 'circle', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 3, 'circle-color': '#3bb2d0' } },
    { 'id': 'gl-draw-point-stroke-active', 'type': 'circle', 'filter': ['all', ['==', '$type', 'Point'], ['==', 'active', 'true'], ['!=', 'meta', 'midpoint']], 'paint': { 'circle-radius': 7, 'circle-color': '#fff' } },
    { 'id': 'gl-draw-point-active', 'type': 'circle', 'filter': ['all', ['==', '$type', 'Point'], ['!=', 'meta', 'midpoint'], ['==', 'active', 'true']], 'paint': { 'circle-radius': 5, 'circle-color': '#fbb03b' } },
    { 'id': 'gl-draw-polygon-fill-static', 'type': 'fill', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']], 'paint': { 'fill-color': '#404040', 'fill-outline-color': '#404040', 'fill-opacity': 0.1 } },
    { 'id': 'gl-draw-polygon-stroke-static', 'type': 'line', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#404040', 'line-width': 2 } },
    { 'id': 'gl-draw-line-static', 'type': 'line', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'LineString']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#404040', 'line-width': 2 } },
    { 'id': 'gl-draw-point-static', 'type': 'circle', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'Point']], 'paint': { 'circle-radius': 5, 'circle-color': '#404040' } },
]

export default function FvcomMap() {
    mapboxgl.accessToken = 'pk.eyJ1Ijoia3hoNDg5MjYzNiIsImEiOiJjbGFhcWYyNmcwNHF3M25vNXJqaW95bDZsIn0.ID03BpkSU7-I0OcehcrvlQ'

    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<mapboxgl.Map | null>(null)
    const fitBoundsRequestId = useFvcomStore((state) => state.fitBoundsRequestId)
    const fitBoundsPayload = useFvcomStore((state) => state.fitBoundsPayload)
    const isSelectingBounds = useFvcomStore((state) => state.isSelectingBounds)
    const setIsSelectingBounds = useFvcomStore((state) => state.setIsSelectingBounds)
    const setAreaBounds = useFvcomStore((state) => state.setAreaBounds)
    const setIsCreateModalOpen = useFvcomStore((state) => state.setIsCreateModalOpen)
    const drawRef = useRef<MapboxDraw | null>(null)
    const flowLayerRef = useRef<FvcomFlowLayer | null>(null)
    const flowManagerRef = useRef<FvcomFlowManager | null>(null)
    const testLayerRef = useRef<FvcomFlowLayer | null>(null)
    const testManagerRef = useRef<FvcomFlowManager | null>(null)
    const selectedCaseID = useFvcomStore((state) => state.selectedCaseID)
    const textureRefreshTrigger = useFvcomStore((state) => state.textureRefreshTrigger)
    const texture = useFvcomStore((state) => state.texture)
    const testTextureEnabled = useFvcomStore((state) => state.testTextureEnabled)
    const [zoom, setZoom] = useState(8)

    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return

        // 强制使用 WebGL2（自定义图层需要 texStorage2D / transform feedback）
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const MapProto = mapboxgl.Map.prototype as any
        if (MapProto._setupPainter.toString().indexOf('webgl2') === -1) {
            const _setupPainter_old = MapProto._setupPainter
            MapProto._setupPainter = function () {
                const getContext_old = this._canvas.getContext
                this._canvas.getContext = function (_name: any, options: any): any {
                    return (
                        getContext_old.apply(this, ['webgl2', options]) ||
                        getContext_old.apply(this, ['webgl', options]) ||
                        getContext_old.apply(this, ['experimental-webgl', options])
                    )
                }
                _setupPainter_old.apply(this)
                this._canvas.getContext = getContext_old
            }
        }

        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [118.96, 31.95], 
            zoom: 8,
        })

        mapRef.current.addControl(
            new MapboxLanguage({
                defaultLanguage: 'zh-Hans',
            }),
        )

        const draw = new MapboxDraw({
            displayControlsDefault: false,
            modes: {
                ...MapboxDraw.modes,
                draw_rectangle: DrawRectangle,
            },
            styles: drawStyles,
        })

        mapRef.current.addControl(draw)
        drawRef.current = draw

        const updateZoom = () => setZoom(Math.round(mapRef.current!.getZoom() * 100) / 100)
        mapRef.current.on('zoom', updateZoom)
        mapRef.current.on('moveend', updateZoom)

        return () => {
            drawRef.current = null
            mapRef.current?.remove()
            mapRef.current = null
        }
    }, [])

    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        if (!fitBoundsPayload) return

        const minLng = Number(fitBoundsPayload.minLng)
        const minLat = Number(fitBoundsPayload.minLat)
        const maxLng = Number(fitBoundsPayload.maxLng)
        const maxLat = Number(fitBoundsPayload.maxLat)

        if ([minLng, minLat, maxLng, maxLat].some((value) => Number.isNaN(value))) {
            return
        }

        map.fitBounds(
            [
                [minLng, minLat],
                [maxLng, maxLat],
            ],
            {
                padding: 60,
                duration: 800,
            },
        )
    }, [fitBoundsRequestId, fitBoundsPayload])

    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        const draw = drawRef.current
        if (!draw) return

        if (!isSelectingBounds) {
            map.getCanvas().style.cursor = ''
            draw.changeMode('simple_select')
            return
        }

        map.getCanvas().style.cursor = 'crosshair'
        draw.deleteAll()
        draw.changeMode('draw_rectangle')

        const handleDrawCreate = (event: { features: Array<GeoJSON.Feature> }) => {
            const feature = event.features[0]
            if (!feature || feature.geometry.type !== 'Polygon') return

            const coordinates = feature.geometry.coordinates[0]
            const lngs = coordinates.map((coord) => coord[0])
            const lats = coordinates.map((coord) => coord[1])

            const toFixed4 = (value: number) => value.toFixed(4)

            setAreaBounds({
                minLng: toFixed4(Math.min(...lngs)),
                minLat: toFixed4(Math.min(...lats)),
                maxLng: toFixed4(Math.max(...lngs)),
                maxLat: toFixed4(Math.max(...lats)),
            })
            draw.deleteAll()
            setIsSelectingBounds(false)
            setIsCreateModalOpen(true)
        }

        map.on('draw.create', handleDrawCreate)
        return () => {
            map.off('draw.create', handleDrawCreate)
            map.getCanvas().style.cursor = ''
        }
    }, [
        isSelectingBounds,
        setAreaBounds,
        setIsCreateModalOpen,
        setIsSelectingBounds,
    ])

    // 加载纹理并创建自定义渲染图层
    useEffect(() => {
        const map = mapRef.current
        if (!map || !selectedCaseID) return

        let cancelled = false

        // 清除旧的自定义图层
        if (flowLayerRef.current) {
            try { map.removeLayer(flowLayerRef.current.id) } catch {}
            flowLayerRef.current = null
        }
        if (flowManagerRef.current) {
            flowManagerRef.current.destroy()
            flowManagerRef.current = null
        }
        texture.clearTextures()

        // 加载纹理列表
        getTexturesAPI(selectedCaseID).then((res) => {
            if (cancelled || res.status !== 'success' || !res.data) return

            const data = res.data as {
                caseID: string
                bounds: [number, number, number, number]
                textures: Array<{ key: string; name: string; url: string; publicUrl: string; size: number }>
            }

            // 保存纹理列表到 store（供 FvcomLayer 控制面板使用）
            texture.setTextures(data.textures, data.bounds)

            // 按文件名匹配纹理类型
            const texList = data.textures
            const findByName = (patterns: RegExp[]) =>
                texList.find((t) => patterns.some((p) => p.test(t.name)))

            const uvTex = findByName([/^uvdp/i, /^uv_/i, /^uv/i])
            const meshTex = findByName([/^mesh/i, /^projection_/i, /^proj/i])
            const seedTex = findByName([/^texture/i, /^seed_/i, /^seed/i, /^valid/i])

            if (!uvTex || !meshTex) return

            // 定位 uvdp1 / uvdp2
            const uv1 = uvTex
            const uv2 = texList.find((t) => {
                const m = t.name.match(/(\d+)/)
                return m && m[1] === '2' && /^uv/i.test(t.name)
            })
            const mesh1 = meshTex
            const mesh2 = texList.find((t) => {
                const m = t.name.match(/(\d+)/)
                return m && m[1] === '2' && /^mesh/i.test(t.name)
            })

            const textureSet: FvcomTextureSet = {
                uvTexture1: uv1.publicUrl,
                uvTexture2: uv2?.publicUrl,
                meshTexture1: mesh1.publicUrl,
                meshTexture2: mesh2?.publicUrl,
                seedTexture: seedTex?.publicUrl,
                bounds: data.bounds,
            }

            const flowManager = new FvcomFlowManager(textureSet)
            const flowLayer = new FvcomFlowLayer(`fvcom-flow-${selectedCaseID}`, '2d', flowManager)

            flowManagerRef.current = flowManager
            flowLayerRef.current = flowLayer
            map.addLayer(flowLayer)
        })

        return () => {
            cancelled = true
            if (flowLayerRef.current) {
                try { map.removeLayer(flowLayerRef.current.id) } catch {}
                flowLayerRef.current = null
            }
            if (flowManagerRef.current) {
                flowManagerRef.current.destroy()
                flowManagerRef.current = null
            }
        }
    }, [selectedCaseID, textureRefreshTrigger])

    // 流场动画显隐控制
    useEffect(() => {
        if (flowLayerRef.current) {
            flowLayerRef.current.visible = texture.flowVisible
        }
    }, [texture.flowVisible])

    // 网格纹理显隐控制
    useEffect(() => {
        if (flowLayerRef.current) {
            flowLayerRef.current.meshVisible = texture.meshVisible
        }
    }, [texture.meshVisible])

    // 本地测试纹理模式
    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        const TEST_LAYER_ID = 'fvcom-flow-test'

        if (!testTextureEnabled) {
            if (testLayerRef.current) {
                try { map.removeLayer(TEST_LAYER_ID) } catch {}
                testLayerRef.current = null
            }
            if (testManagerRef.current) {
                testManagerRef.current.destroy()
                testManagerRef.current = null
            }
            return
        }

        // 如果已经有测试图层，先移除
        if (testLayerRef.current) {
            try { map.removeLayer(TEST_LAYER_ID) } catch {}
            testLayerRef.current = null
        }
        if (testManagerRef.current) {
            testManagerRef.current.destroy()
            testManagerRef.current = null
        }

        // 使用地图中心附近的默认范围
        const center = map.getCenter()
        const size = 1.5
        const bounds: [number, number, number, number] = [
            center.lng - size, center.lat - size,
            center.lng + size, center.lat + size,
        ]

        const textureSet: FvcomTextureSet = {
            uvTexture1: '/textures/test/uv_0001.png',
            uvTexture2: '/textures/test/uv_0002.png',
            meshTexture1: '/textures/test/projection_mapbox.png',
            seedTexture: '/textures/test/seed_0001.png',
            bounds,
        }

        const manager = new FvcomFlowManager(textureSet)
        const layer = new FvcomFlowLayer(TEST_LAYER_ID, '2d', manager)

        testManagerRef.current = manager
        testLayerRef.current = layer
        map.addLayer(layer)

        return () => {
            try { map.removeLayer(TEST_LAYER_ID) } catch {}
            testLayerRef.current = null
            if (testManagerRef.current) {
                testManagerRef.current.destroy()
                testManagerRef.current = null
            }
        }
    }, [testTextureEnabled])

    return (
        <div className="relative h-full w-full">
            <div ref={mapContainerRef} className="h-full w-full" />
            <MiniMap zoom={zoom} />
        </div>
    )
}