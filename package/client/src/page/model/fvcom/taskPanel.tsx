import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFvcomStore } from '@/store/FvcomStroe'
import { getCaseListAPI, resetCaseStatusAPI } from './fvcom.api'
import TaskCard from './TaskCard'

type RunningCase = {
    caseID: string
    caseName: string
    progress: number
}

type TaskPanelProps = {
    isOpen: boolean
    onToggle: () => void
}

export default function TaskPanel({ isOpen, onToggle }: TaskPanelProps) {
    const [tasks, setTasks] = useState<RunningCase[]>([])
    const [loading, setLoading] = useState(false)
    const taskRefreshTrigger = useFvcomStore((state) => state.taskRefreshTrigger)

    const fetchRunningCases = async () => {
        setLoading(true)
        try {
            const result = await getCaseListAPI()
            if (result.status === 'success' && result.data) {
                const running = result.data.filter(
                    (item: { status: string }) => item.status === 'running',
                )
                setTasks(running)
            }
        } catch (error) {
            console.error('获取运行案例失败:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!isOpen) return
        fetchRunningCases()
    }, [isOpen, taskRefreshTrigger])

    const handleCancelTask = async (caseID: string) => {
        await resetCaseStatusAPI(caseID)
        fetchRunningCases()
    }

    return (
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex h-[70%]">
            <div
                className={`pointer-events-auto flex h-full w-80 flex-col overflow-hidden rounded-l-lg rounded-br-lg border border-slate-200 bg-white shadow transition-all duration-300 ${isOpen ? 'max-w-[20rem] opacity-100' : 'max-w-0 opacity-0'}`}
            >
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                    运行中的 FVCOM 案例任务
                </div>
                <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-3">
                    {loading ? (
                        <div className="text-sm text-slate-500">加载中...</div>
                    ) : tasks.length === 0 ? (
                        <div className="text-sm text-slate-500">暂无运行中案例</div>
                    ) : (
                        tasks.map((task) => (
                            <TaskCard
                                key={task.caseID}
                                name={task.caseName}
                                progress={Math.round(task.progress * 100)}
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
