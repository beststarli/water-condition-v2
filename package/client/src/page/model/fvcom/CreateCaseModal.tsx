import { Square } from 'lucide-react'

type CreateCaseModalProps = {
    isOpen: boolean
    caseName: string
    onCaseNameChange: (value: string) => void
    areaBounds: {
        minLng: string
        minLat: string
        maxLng: string
        maxLat: string
    }
    onBoundsChange: (value: Partial<CreateCaseModalProps['areaBounds']>) => void
    onClose: () => void
    onConfirm: () => void
    onPickFromMap: () => void
}

export default function CreateCaseModal({
    isOpen,
    caseName,
    onCaseNameChange,
    areaBounds,
    onBoundsChange,
    onClose,
    onConfirm,
    onPickFromMap,
}: CreateCaseModalProps) {
    const handleBoundsBlur = (value: string, key: keyof CreateCaseModalProps['areaBounds']) => {
        const numericValue = Number(value)
        if (Number.isNaN(numericValue)) return
        onBoundsChange({ [key]: numericValue.toFixed(4) })
    }

    if (!isOpen) return null

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="w-[38rem] rounded-lg bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <div className="text-base font-medium text-slate-800">案例创建</div>
                    <button type="button" onClick={onClose} className="text-sm text-slate-500">
                        关闭
                    </button>
                </div>
                <div className="px-5 py-4">
                    <div className="mb-4">
                        <div className="mb-2 text-sm text-slate-700">案例名称</div>
                        <input
                            value={caseName}
                            onChange={(event) => onCaseNameChange(event.target.value)}
                            placeholder="请输入案例名称"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-[80%] grid grid-cols-2 gap-2 border-r border-slate-200 pr-4">
                            <div>
                                <div className="mb-1 text-xs text-slate-500">最小经度</div>
                                <input
                                    value={areaBounds.minLng}
                                    onChange={(event) => onBoundsChange({ minLng: event.target.value })}
                                    onBlur={(event) => handleBoundsBlur(event.target.value, 'minLng')}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <div className="mb-1 text-xs text-slate-500">最小纬度</div>
                                <input
                                    value={areaBounds.minLat}
                                    onChange={(event) => onBoundsChange({ minLat: event.target.value })}
                                    onBlur={(event) => handleBoundsBlur(event.target.value, 'minLat')}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <div className="mb-1 text-xs text-slate-500">最大经度</div>
                                <input
                                    value={areaBounds.maxLng}
                                    onChange={(event) => onBoundsChange({ maxLng: event.target.value })}
                                    onBlur={(event) => handleBoundsBlur(event.target.value, 'maxLng')}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <div className="mb-1 text-xs text-slate-500">最大纬度</div>
                                <input
                                    value={areaBounds.maxLat}
                                    onChange={(event) => onBoundsChange({ maxLat: event.target.value })}
                                    onBlur={(event) => handleBoundsBlur(event.target.value, 'maxLat')}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex w-[20%] items-center justify-center">
                            <button
                                type="button"
                                onClick={onPickFromMap}
                                className="border border-slate-300 text-sm w-20 h-20 rounded-xl bg-blue-500 p-2 flex flex-col items-center justify-center text-white cursor-pointer gap-0.5"
                            >
                                <Square className="h-8 w-8 text-white" />
                                <span className="text-white">地图框选</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-md bg-[#135eb0] px-4 py-2 text-sm text-white"
                    >
                        确认创建
                    </button>
                </div>
            </div>
        </div>
    )
}
