import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { useFvcomStore } from '@/store/FvcomStroe'

type MiniMapProps = {
    zoom: number
}

export default function MiniMap({ zoom }: MiniMapProps) {
    const selectedCaseBounds = useFvcomStore((state) => state.selectedCaseBounds)
    const requestFitBounds = useFvcomStore((state) => state.requestFitBounds)

    const handleClick = () => {
        if (!selectedCaseBounds) return
        requestFitBounds({
            minLng: String(selectedCaseBounds[0]),
            minLat: String(selectedCaseBounds[1]),
            maxLng: String(selectedCaseBounds[2]),
            maxLat: String(selectedCaseBounds[3]),
        })
    }

    const noCase = !selectedCaseBounds

    return (
        <div className="absolute right-4 top-4 z-10">
            <div
                onClick={handleClick}
                className={`
                    rounded-2xl border border-slate-200 bg-white/75 px-3 py-2 text-xs
                    text-slate-700 shadow-lg backdrop-blur-md transition-colors
                    ${noCase ? '' : 'cursor-pointer hover:bg-white/90'}
                `}
            >
                {/* 縮放等級 */}
                <div className="mb-2 text-center text-[11px] text-slate-500">
                    缩放等级 <span className="font-bold text-slate-800">{zoom}</span>
                </div>

                {noCase ? (
                    <div className="flex h-24 w-44 items-center justify-center text-slate-400">
                        未选择案例
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                        {/* Top Left */}
                        <div className="relative flex h-6 items-center justify-center">
                            <div className="absolute left-0 top-0 h-3 w-3 border-l border-t border-slate-400 rounded-tl" />
                        </div>
                        {/* North */}
                        <div className="flex flex-col items-center">
                            <ArrowUp className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-[11px] font-bold text-blue-500">N</span>
                            <span className="text-[10px] text-slate-600">{selectedCaseBounds[3].toFixed(4)}</span>
                        </div>
                        {/* Top Right */}
                        <div className="relative flex h-6 items-center justify-center">
                            <div className="absolute right-0 top-0 h-3 w-3 border-r border-t border-slate-400 rounded-tr" />
                        </div>

                        {/* West */}
                        <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center gap-0.5">
                                <ArrowLeft className="h-3.5 w-3.5 text-green-500" />
                                <span className="text-[11px] font-bold text-green-500">W</span>
                            </div>
                            <span className="text-[10px] text-slate-600">{selectedCaseBounds[0].toFixed(4)}</span>
                        </div>
                        {/* Center */}
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-[10px] font-bold text-orange-500">Center</span>
                            <span className="text-[10px] text-slate-600">
                                {((selectedCaseBounds[0] + selectedCaseBounds[2]) / 2).toFixed(4)}
                            </span>
                            <span className="text-[10px] text-slate-600">
                                {((selectedCaseBounds[1] + selectedCaseBounds[3]) / 2).toFixed(4)}
                            </span>
                        </div>
                        {/* East */}
                        <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center gap-0.5">
                                <span className="text-[11px] font-bold text-red-500">E</span>
                                <ArrowRight className="h-3.5 w-3.5 text-red-500" />
                            </div>
                            <span className="text-[10px] text-slate-600">{selectedCaseBounds[2].toFixed(4)}</span>
                        </div>

                        {/* Bottom Left */}
                        <div className="relative flex h-6 items-center justify-center">
                            <div className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-slate-400 rounded-bl" />
                        </div>
                        {/* South */}
                        <div className="flex flex-col items-center">
                            <span className="text-[11px] font-bold text-purple-500">S</span>
                            <ArrowDown className="h-3.5 w-3.5 text-purple-500" />
                            <span className="text-[10px] text-slate-600">{selectedCaseBounds[1].toFixed(4)}</span>
                        </div>
                        {/* Bottom Right */}
                        <div className="relative flex h-6 items-center justify-center">
                            <div className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-slate-400 rounded-br" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
