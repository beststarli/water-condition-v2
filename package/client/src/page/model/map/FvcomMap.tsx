import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxLanguage from '@mapbox/mapbox-gl-language'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl-draw/dist/mapbox-gl-draw.css'
// @ts-expect-error no declare file for rectangle mode
import DrawRectangle from 'mapbox-gl-draw-rectangle-mode'
import { useFvcomStore } from '@/store/FvcomStroe'

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
        })

        mapRef.current.addControl(draw)
        drawRef.current = draw

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
        <div className="flex h-[100%] w-[100%] items-center justify-center">
            <div ref={mapContainerRef} className="h-full w-full" />
        </div>
    )
}