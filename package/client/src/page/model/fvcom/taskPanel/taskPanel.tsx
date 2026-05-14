import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFvcomStore } from '@/store/FvcomStroe'
import { resetCaseStatusAPI } from '../../../../api/fvcom/fvcom.api'
import TaskCard from './TaskCard'

type RunningCase = {
    caseID: string
    caseName: string
    progress: number
    status: string
}

type TaskPanelProps = {
    isOpen: boolean
    onToggle: () => void
}

export default function TaskPanel({ isOpen, onToggle }: TaskPanelProps) {
    const [tasks, setTasks] = useState<RunningCase[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const watchedTaskIds = useFvcomStore((state) => state.watchedTaskIds)
    const removeWatchedTaskId = useFvcomStore((state) => state.removeWatchedTaskId)
    const addWatchedTaskId = useFvcomStore((state) => state.addWatchedTaskId)

    useEffect(() => {
        if (!isOpen) return

        setInitialLoading(true)

        const es = new EventSource('/api/v1/fvcom/progress/tasks')

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                const active = data.filter(
                    (item: { status: string }) =>
                        item.status === 'running' || item.status === 'completed',
                )
                setTasks(active)

                // 自動追蹤尚未關注的 running 任務（瀏覽器刷新後恢復）
                const currentWatched = useFvcomStore.getState().watchedTaskIds
                active.forEach((item: RunningCase) => {
                    if (item.status === 'running' && !currentWatched.includes(item.caseID)) {
                        addWatchedTaskId(item.caseID)
                    }
                })
            } catch (e) {
                console.error('SSE 数据解析失败:', e)
            } finally {
                setInitialLoading(false)
            }
        }

        return () => es.close()
    }, [isOpen])

    const handleCancelTask = async (caseID: string) => {
        const result = await resetCaseStatusAPI(caseID)
        if (result.status !== 'success') {
            console.error('取消任务失败:', result.message)
            return
        }
        removeWatchedTaskId(caseID)
        useFvcomStore.getState().triggerExecutingRefresh()
    }

    const visibleTasks = tasks
        .filter((t) => watchedTaskIds.includes(t.caseID))
        .sort((a, b) => watchedTaskIds.indexOf(a.caseID) - watchedTaskIds.indexOf(b.caseID))

    return (
        <div className="pointer-events-none absolute left-2 top-2 z-20 flex h-[70%]">
            <div
                className={`pointer-events-auto flex h-full w-80 flex-col overflow-hidden rounded-l-lg rounded-br-lg border border-slate-200 bg-white shadow transition-all duration-300 ${isOpen ? 'max-w-[20rem] opacity-100' : 'max-w-0 opacity-0'}`}
            >
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                    运行中的 FVCOM 案例任务
                </div>
                <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-3">
                    {initialLoading ? (
                        <div className="text-sm text-slate-500">加载中...</div>
                    ) : visibleTasks.length === 0 ? (
                        <div className="text-sm text-slate-500">暂无运行中案例</div>
                    ) : (
                        visibleTasks.map((task) => (
                            <TaskCard
                                key={task.caseID}
                                name={task.caseName}
                                progress={Math.round(task.progress * 100)}
                                status={task.status as 'running' | 'completed'}
                                onCancel={() => handleCancelTask(task.caseID)}
                            />
                        ))
                    )}
                </div>
            </div>
            <div className="pointer-events-auto">
                <button
                    type="button"
                    onClick={onToggle}
                    className="rounded-r-3xl bg-[#135eb0] px-3 py-2 text-sm text-white shadow flex items-center"
                >
                    {isOpen ? (
                        <div className="flex items-center">
                            <span className="mr-1">收起运行案例面板</span>
                            <ChevronLeft />
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <span className="mr-1">展开运行案例面板</span>
                            <ChevronRight />
                        </div>
                    )}
                </button>
            </div>
        </div>
    )
}
