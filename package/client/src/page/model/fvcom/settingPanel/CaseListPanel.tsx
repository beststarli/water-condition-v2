import { useEffect, useState } from 'react'
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
import { useFvcomStore } from '@/store/FvcomStroe'
import { deleteCaseActionAPI, getCaseListAPI } from '../../../../api/fvcom/fvcom.api'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'

type CaseListItem = {
    caseID: string
    caseName: string
    areaBounds: [number, number, number, number]
    filePaths: string[]
    progress: number
    status: 'idle' | 'running' | 'completed'
}

type CaseListPanelProps = {
    isOpen: boolean
    onClose: () => void
}

export default function CaseListPanel({ isOpen, onClose }: CaseListPanelProps) {
    const [cases, setCases] = useState<CaseListItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const loadCases = async () => {
        setIsLoading(true)
        setErrorMessage('')
        const result = await getCaseListAPI()
        console.log('getCaseListAPI result', result.data)

        if (result.status !== 'success' || !result.data) {
            setErrorMessage(result.message || '加载失败')
            setCases([])
            setIsLoading(false)
            return
        }

        setCases(result.data)
        setIsLoading(false)
    }

    useEffect(() => {
        if (!isOpen) return
        loadCases()
    }, [isOpen])

    const handleDeleteCase = async (caseID: string) => {
        const result = await deleteCaseActionAPI(caseID)
        if (result.status !== 'success') {
            setErrorMessage(result.message || '删除失败')
            return
        }
        // 如果刪除了運行中的案例，通知任務面板刷新
        const deletedCase = cases.find((c) => c.caseID === caseID)
        if (deletedCase?.status === 'running') {
            useFvcomStore.getState().triggerTaskRefresh()
        }
        await loadCases()
    }

    if (!isOpen) return null

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="h-[60vh] w-[45rem] rounded-lg bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <div className="text-base font-medium text-slate-800">已有案例列表</div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm text-slate-500"
                    >
                        关闭
                    </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                    {isLoading ? (
                        <div className="text-sm text-slate-600">加载中...</div>
                    ) : errorMessage ? (
                        <div className="text-sm text-rose-500">{errorMessage}</div>
                    ) : cases.length === 0 ? (
                        <div className="flex h-full w-full items-center justify-center p-4">
                            <div className="text-3xl font-bold">
                                暂无已创建的案例
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {cases.map((item) => (
                                <Card key={item.caseID} className="flex h-full flex-col border-slate-200 shadow-md space-y-1">
                                    <CardHeader className="pb-2 border-b border-slate-200">
                                        <CardTitle className='flex items-center justify-around'>
                                            <span className='text-xl'>{item.caseName}</span>
                                            <span className='text-sm font-normal'>
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        item.status === 'idle'
                                                            ? 'bg-slate-100 text-slate-500'
                                                            : item.status === 'running'
                                                              ? 'bg-orange-50 text-orange-600'
                                                              : 'bg-emerald-50 text-emerald-600'
                                                    }`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${
                                                            item.status === 'idle'
                                                                ? 'bg-slate-400'
                                                                : item.status === 'running'
                                                                  ? 'bg-orange-400'
                                                                  : 'bg-emerald-500'
                                                        }`}
                                                    />
                                                    {item.status === 'idle'
                                                        ? '未启动'
                                                        : item.status === 'running'
                                                          ? '运行中'
                                                          : '已完成'}
                                                </span>
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col space-y-3">
                                        <div className="text-xs text-slate-500">
                                            经度范围：{item.areaBounds[0]} ~ {item.areaBounds[2]}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            纬度范围：{item.areaBounds[1]} ~ {item.areaBounds[3]}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="mt-auto justify-end gap-2 pb-3">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                useFvcomStore.getState().setCurrentCase(
                                                    item.caseID,
                                                    item.caseName,
                                                    item.filePaths,
                                                    item.areaBounds,
                                                )
                                                onClose()
                                            }}
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
                                                        onClick={() => handleDeleteCase(item.caseID)}
                                                    >
                                                        确认删除
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
