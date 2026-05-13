import React, { useRef, useState } from 'react'
import { useFvcomStore } from '@/store/FvcomStroe'
import { CheckCircle, Circle } from 'lucide-react'
import { createCaseActionAPI } from './fvcom.api'
import CaseListPanel from './CaseListPanel'
import CreateCaseModal from './CreateCaseModal'

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
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleCloseModal = () => {
        setIsCreateModalOpen(false)
    }

    const handleConfirmCreate = async () => {
        const minLng = Number(areaBounds.minLng)
        const minLat = Number(areaBounds.minLat)
        const maxLng = Number(areaBounds.maxLng)
        const maxLat = Number(areaBounds.maxLat)

        if ([minLng, minLat, maxLng, maxLat].some((value) => Number.isNaN(value))) {
            return
        }

        const result = await createCaseActionAPI({
            action: 'create',
            caseID: null,
            caseName: createCaseName.trim() || '未命名案例',
            caseBounds: [minLng, minLat, maxLng, maxLat],
        })

        if (result.status !== 'success') {
            console.error('创建案例失败:', result.message)
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
            <CreateCaseModal
                isOpen={isCreateModalOpen}
                caseName={createCaseName}
                onCaseNameChange={setCreateCaseName}
                areaBounds={areaBounds}
                onBoundsChange={setAreaBounds}
                onClose={handleCloseModal}
                onConfirm={handleConfirmCreate}
                onPickFromMap={handleGetBoundsFromMap}
            />
            <CaseListPanel
                isOpen={isCaseListOpen}
                onClose={() => setIsCaseListOpen(false)}
            />
        </div>
    )
}
