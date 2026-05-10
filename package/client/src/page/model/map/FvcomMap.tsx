import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxLanguage from '@mapbox/mapbox-gl-language'
import { useFvcomStore } from '@/store/FvcomStroe'

export default function FvcomMap() {
    mapboxgl.accessToken = 'pk.eyJ1Ijoia3hoNDg5MjYzNiIsImEiOiJjbGFhcWYyNmcwNHF3M25vNXJqaW95bDZsIn0.ID03BpkSU7-I0OcehcrvlQ'

    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<mapboxgl.Map | null>(null)
    const fitBoundsRequestId = useFvcomStore((state) => state.fitBoundsRequestId)
    const fitBoundsPayload = useFvcomStore((state) => state.fitBoundsPayload)

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

        return () => {
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

    return (
        <div className="flex h-[100%] w-[100%] items-center justify-center">
            <div ref={mapContainerRef} className="h-full w-full" />
        </div>
    )
}