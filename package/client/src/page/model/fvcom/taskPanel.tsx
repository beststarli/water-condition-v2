
import { ChevronLeft, ChevronRight } from 'lucide-react'
import TaskCard from './TaskCard'

type TaskPanelProps = {
    isOpen: boolean
    onToggle: () => void
}

export default function TaskPanel({ isOpen, onToggle }: TaskPanelProps) {
    const tasks = [
        { id: 'task-1', name: '案例 A', progress: 42 },
        { id: 'task-2', name: '案例 B', progress: 68 },
        { id: 'task-3', name: '案例 C', progress: 15 },
    ]

    return (
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex h-[70%]">
            <div className={`pointer-events-auto flex h-full w-80 flex-col overflow-hidden rounded-l-lg rounded-br-lg border border-slate-200 bg-white shadow transition-all duration-300 ${isOpen ? 'max-w-[20rem] opacity-100' : 'max-w-0 opacity-0'}`}>
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                    运行中的 FVCOM 案例任务
                </div>
                <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-3">
                    {tasks.length === 0 ? (
                        <div className="text-sm text-slate-600">暂无运行中案例</div>
                    ) : (
                        tasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                name={task.name}
                                progress={task.progress}
                                onCancel={() => console.log('cancel', task.id)}
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
                            <span className="mr-1">收起运行案例面板</span><ChevronLeft />
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <span className="mr-1">展开运行案例面板</span><ChevronRight />
                        </div>
                    )}
                </button>
            </div>
        </div>
    )
}
