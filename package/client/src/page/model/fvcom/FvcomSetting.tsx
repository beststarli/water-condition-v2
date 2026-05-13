import { useEffect, useMemo, useRef, useState } from 'react'
import { useFvcomStore } from '@/store/FvcomStroe'
import { Trash2, FileText, Loader2 } from 'lucide-react'
import { createCaseActionAPI, uploadFilesAPI, executeModelAPI } from './fvcom.api'
import CaseListPanel from './CaseListPanel'
import CreateCaseModal from './CreateCaseModal'

interface UploadedFile {
    path: string
    name: string
}

export default function FvcomSetting() {
    const isCreateModalOpen = useFvcomStore((state) => state.isCreateModalOpen)
    const createCaseName = useFvcomStore((state) => state.createCaseName)
    const areaBounds = useFvcomStore((state) => state.areaBounds)
    const setIsCreateModalOpen = useFvcomStore((state) => state.setIsCreateModalOpen)
    const setCreateCaseName = useFvcomStore((state) => state.setCreateCaseName)
    const setAreaBounds = useFvcomStore((state) => state.setAreaBounds)
    const requestFitBounds = useFvcomStore((state) => state.requestFitBounds)
    const setIsSelectingBounds = useFvcomStore((state) => state.setIsSelectingBounds)
    const selectedCaseID = useFvcomStore((state) => state.selectedCaseID)
    const selectedFilePaths = useFvcomStore((state) => state.selectedFilePaths)
    const setCurrentCase = useFvcomStore((state) => state.setCurrentCase)
    const [fileList, setFileList] = useState<UploadedFile[]>([])
    const [uploading, setUploading] = useState(false)
    const [isCaseListOpen, setIsCaseListOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 模型計算執行狀態
    const [executing, setExecuting] = useState(false)

    // 虚拟列表
    const listRef = useRef<HTMLDivElement>(null)
    const [listHeight, setListHeight] = useState(0)
    const [scrollTop, setScrollTop] = useState(0)
    const rowHeight = 36
    const overscan = 6

    useEffect(() => {
        const el = listRef.current
        if (!el) return

        setListHeight(el.clientHeight)
        const observer = new ResizeObserver(() => setListHeight(el.clientHeight))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // 當從「查看」按鈕選中案例時，更新文件列表
    useEffect(() => {
        if (selectedCaseID && selectedFilePaths.length > 0) {
            setFileList(
                selectedFilePaths.map((p) => ({
                    path: p,
                    name: p.split(/[\\/]/).pop() || p,
                })),
            )
        }
    }, [selectedCaseID, selectedFilePaths])

    const visibleRange = useMemo(() => {
        if (listHeight === 0) {
            return { startIndex: 0, endIndex: Math.min(fileList.length, overscan * 2) }
        }
        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
        const endIndex = Math.min(
            fileList.length,
            Math.ceil((scrollTop + listHeight) / rowHeight) + overscan,
        )
        return { startIndex, endIndex }
    }, [fileList.length, listHeight, scrollTop])

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

        if (result.status !== 'success' || !result.data) {
            console.error('创建案例失败:', result.message)
            return
        }

        // 儲存建立的案例 ID
        setCurrentCase(result.data, createCaseName.trim() || '未命名案例', [])

        requestFitBounds({
            minLng: String(minLng),
            minLat: String(minLat),
            maxLng: String(maxLng),
            maxLat: String(maxLat),
        })
        setIsCreateModalOpen(false)
    }

    const handleOpenFilePicker = () => {
        fileInputRef.current?.click()
    }

    const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        try {
            const result = await uploadFilesAPI(Array.from(files))
            if (result.status === 'success' && result.data) {
                setFileList((prev) => [
                    ...prev,
                    ...result.data!.map((p: string) => ({
                        path: p,
                        name: p.split(/[\\/]/).pop() || p,
                    })),
                ])
            } else {
                console.error('上传失败:', result.message)
            }
        } catch (error) {
            console.error('上传异常:', error)
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleRemoveFile = (index: number) => {
        setFileList((prev) => prev.filter((_, i) => i !== index))
    }

    const handleClearFiles = () => {
        setFileList([])
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleExecute = async () => {
        const caseID = selectedCaseID
        if (!caseID || fileList.length === 0) return

        setExecuting(true)

        try {
            const result = await executeModelAPI(caseID, fileList.map((f) => f.path))
            if (result.status !== 'success') {
                setExecuting(false)
            }
        } catch (error) {
            setExecuting(false)
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
                        <div className="text-sm font-medium text-slate-700">模型数据文件</div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleClearFiles}
                                disabled={uploading || fileList.length === 0 || executing}
                                className="rounded-md border border-red-500 px-3 py-1 text-xs text-red-500 disabled:opacity-50"
                            >
                                全部清除
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenFilePicker}
                                disabled={uploading || executing}
                                className="rounded-md bg-[#135eb0] px-3 py-1 text-xs text-white disabled:opacity-50"
                            >
                                {uploading ? '上传中...' : '上传文件'}
                            </button>
                        </div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                    />
                    {/* 檔案列表 */}
                    <div className="flex-1 min-h-0">
                        {uploading && (
                            <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                正在上传文件...
                            </div>
                        )}
                        {fileList.length === 0 && !uploading && (
                            <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                                暂无文件，请点击上方按钮上传
                            </div>
                        )}
                        {fileList.length > 0 && (
                            <div
                                ref={listRef}
                                className="h-full overflow-y-auto hide-scrollbar"
                                onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                            >
                                <div
                                    className="relative"
                                    style={{ height: fileList.length * rowHeight }}
                                >
                                    {fileList
                                        .slice(visibleRange.startIndex, visibleRange.endIndex)
                                        .map((item, offset) => {
                                            const index = visibleRange.startIndex + offset
                                            return (
                                                <div
                                                    key={item.path}
                                                    className="group flex items-center justify-between rounded-md px-2 text-sm text-slate-600 hover:bg-slate-50"
                                                    style={{
                                                        position: 'absolute',
                                                        top: index * rowHeight,
                                                        left: 0,
                                                        right: 0,
                                                        height: rowHeight,
                                                    }}
                                                >
                                                    <div className="flex min-w-0 flex-1 items-center">
                                                        <FileText className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                                                        <span className="truncate" title={item.path}>
                                                            {item.path}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile(index)}
                                                        className="ml-2 shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="border-t border-slate-200 p-2">
                    <button
                        type="button"
                        onClick={handleExecute}
                        disabled={fileList.length === 0 || executing || !selectedCaseID}
                        className="w-full rounded-md bg-[#135eb0] py-2 text-sm text-white disabled:opacity-50"
                    >
                        {executing ? '运行中' : '执行模型计算'}
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
