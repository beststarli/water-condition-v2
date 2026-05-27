import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxLanguage from '@mapbox/mapbox-gl-language'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl-draw/dist/mapbox-gl-draw.css'
// @ts-expect-error no declare file for rectangle mode
import DrawRectangle from 'mapbox-gl-draw-rectangle-mode'
import { useFvcomStore } from '@/store/FvcomStroe'
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
    const [zoom, setZoom] = useState(8)

    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return

        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [121.5, 38.9], // 渤海湾中心大致坐标
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

    return (
        <div className="relative h-full w-full">
            <div ref={mapContainerRef} className="h-full w-full" />
            <MiniMap zoom={zoom} />
        </div>
    )
}