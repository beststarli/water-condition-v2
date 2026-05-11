import React, { useRef, useState } from 'react'
import { useFvcomStore } from '@/store/FvcomStroe'
import { CheckCircle, Circle, Square } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function FvcomSetting() {
    const isCreateModalOpen = useFvcomStore((state) => state.isCreateModalOpen)
    const createCaseName = useFvcomStore((state) => state.createCaseName)
    const areaBounds = useFvcomStore((state) => state.areaBounds)
    const setIsCreateModalOpen = useFvcomStore((state) => state.setIsCreateModalOpen)
    const setCreateCaseName = useFvcomStore((state) => state.setCreateCaseName)
    const setProjectName = useFvcomStore((state) => state.setProjectName)
    const setAreaBounds = useFvcomStore((state) => state.setAreaBounds)
    const requestFitBounds = useFvcomStore((state) => state.requestFitBounds)
    const setIsSelectingBounds = useFvcomStore((state) => state.setIsSelectingBounds)
    const [uploadItems, setUploadItems] = useState([
        { name: '文件1', uploaded: false },
        { name: '文件2', uploaded: false },
        { name: '文件3', uploaded: false },
    ])
    const [isCaseListOpen, setIsCaseListOpen] = useState(false)
    const [finishedCases, setFinishedCases] = useState([
        { id: 'case-1', name: '案例一', minLng: 120.8, minLat: 38.4, maxLng: 122.2, maxLat: 39.2 },
        { id: 'case-2', name: '案例二', minLng: 121.1, minLat: 38.0, maxLng: 123.0, maxLat: 39.0 },
    ])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleCloseModal = () => {
        setIsCreateModalOpen(false)
    }

    const handleConfirmCreate = () => {
        const minLng = Number(areaBounds.minLng)
        const minLat = Number(areaBounds.minLat)
        const maxLng = Number(areaBounds.maxLng)
        const maxLat = Number(areaBounds.maxLat)

        if ([minLng, minLat, maxLng, maxLat].some((value) => Number.isNaN(value))) {
            return
        }

        requestFitBounds({
            minLng: String(minLng),
            minLat: String(minLat),
            maxLng: String(maxLng),
            maxLat: String(maxLat),
        })
        setProjectName(createCaseName.trim() || '未命名案例')
        setIsCreateModalOpen(false)
    }

    const handleOpenFilePicker = () => {
        fileInputRef.current?.click()
    }

    const handleFileSelected = () => {
        setUploadItems((items) => {
            const nextIndex = items.findIndex((item) => !item.uploaded)
            if (nextIndex === -1) return items
            return items.map((item, index) =>
                index === nextIndex ? { ...item, uploaded: true } : item,
            )
        })
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleDeleteCase = (caseId: string) => {
        setFinishedCases((cases) => cases.filter((item) => item.id !== caseId))
    }

    const handleGetBoundsFromMap = () => {
        setIsCreateModalOpen(false)
        setIsSelectingBounds(true)
    }

    return (
        <div className="flex-1 min-h-0">
            <div className="flex h-full flex-col border border-slate-300 bg-white">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                    案例配置面板
                </div>
                <div className="p-2 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full rounded-md bg-[#135eb0] py-2 text-sm text-white"
                    >
                        案例创建
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCaseListOpen(true)}
                        className="w-full rounded-md border border-[#135eb0] py-2 text-sm text-[#135eb0]"
                    >
                        已有案例选择
                    </button>
                </div>
                <div className="flex flex-1 min-h-0 flex-col border-t border-slate-200 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-700">模型数据上传</div>
                        <button
                            type="button"
                            onClick={handleOpenFilePicker}
                            className="rounded-md bg-[#135eb0] px-3 py-1 text-xs text-white"
                        >
                            上传文件
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileSelected}
                    />
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                        {uploadItems.map((item) => (
                            <div key={item.name} className="flex items-center text-sm text-slate-600">
                                {item.uploaded ? (
                                    <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                                ) : (
                                    <Circle className="mr-2 h-4 w-4 text-slate-400" />
                                )}
                                <span>{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="border-t border-slate-200 p-2 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => console.log('执行模型计算')}
                        className="w-full rounded-md bg-[#135eb0] py-2 text-sm text-white"
                    >
                        执行模型计算
                    </button>
                </div>
            </div>
            {isCreateModalOpen ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
                    <div className="w-[38rem] rounded-lg bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                            <div className="text-base font-medium text-slate-800">案例创建</div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="text-sm text-slate-500"
                            >
                                关闭
                            </button>
                        </div>
                        <div className="px-5 py-4">
                            <div className="mb-4">
                                <div className="mb-2 text-sm text-slate-700">案例名称</div>
                                <input
                                    value={createCaseName}
                                    onChange={(event) => setCreateCaseName(event.target.value)}
                                    placeholder="请输入案例名称"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className=" w-[80%] grid grid-cols-2 gap-2 border-r border-slate-200 pr-4">
                                    <div>
                                        <div className="mb-1 text-xs text-slate-500">最小经度</div>
                                        <input
                                            value={areaBounds.minLng}
                                            onChange={(event) => setAreaBounds({ minLng: event.target.value })}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <div className="mb-1 text-xs text-slate-500">最小纬度</div>
                                        <input
                                            value={areaBounds.minLat}
                                            onChange={(event) => setAreaBounds({ minLat: event.target.value })}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <div className="mb-1 text-xs text-slate-500">最大经度</div>
                                        <input
                                            value={areaBounds.maxLng}
                                            onChange={(event) => setAreaBounds({ maxLng: event.target.value })}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <div className="mb-1 text-xs text-slate-500">最大纬度</div>
                                        <input
                                            value={areaBounds.maxLat}
                                            onChange={(event) => setAreaBounds({ maxLat: event.target.value })}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex w-[20%] items-center justify-center">
                                    <div
                                        className="border border-slate-300 text-sm w-20 h-20 rounded-xl bg-blue-500 p-2 flex flex-col items-center justify-center text-white cursor-pointer gap-0.5"
                                        onClick={handleGetBoundsFromMap}
                                    >
                                        <Square className="h-8 w-8 text-white" />
                                        <span className="text-white">地图框选</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCreate}
                                className="rounded-md bg-[#135eb0] px-4 py-2 text-sm text-white"
                            >
                                确认创建
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {isCaseListOpen ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
                    <div className="w-[42rem] h-[60vh] rounded-lg bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                            <div className="text-base font-medium text-slate-800">已完成案例</div>
                            <button
                                type="button"
                                onClick={() => setIsCaseListOpen(false)}
                                className="text-sm text-slate-500"
                            >
                                关闭
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                            <div className="grid grid-cols-3 gap-3">
                                {finishedCases.length === 0 ? (
                                    <div className="col-span-3 text-sm text-slate-600">暂无已完成案例</div>
                                ) : (
                                    finishedCases.map((item) => (
                                        <Card key={item.id} className="border-slate-200 shadow-md">
                                            <CardHeader className="pb-2">
                                                <CardTitle>{item.name}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="text-xs text-slate-500">
                                                    经度范围：{item.minLng} ~ {item.maxLng}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    纬度范围：{item.minLat} ~ {item.maxLat}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => console.log('view', item.id)}
                                                    >
                                                        查看
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="destructive" size="sm">
                                                                删除
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>确认删除案例？</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    删除后将无法恢复该案例。
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>取消</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleDeleteCase(item.id)}
                                                                >
                                                                    确认删除
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
