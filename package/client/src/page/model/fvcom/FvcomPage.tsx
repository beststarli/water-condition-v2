import { useState } from 'react'
import FvcomMap from '../map/FvcomMap'
import { useFvcomStore } from '@/store/FvcomStroe'
import FvcomSetting from './settingPanel/FvcomSetting'
import TaskPanel from './taskPanel/taskPanel'
import FvcomLayer from './FvcomLayer'

export default function FvcomPage() {
    const projectName = useFvcomStore((state) => state.projectName)
    const [isPanelOpen, setIsPanelOpen] = useState(false)


    return (
        <div className="relative flex h-screen w-screen flex-col">
            <div className="z--1 h-16 w-screen bg-[#135eb0] p-5 text-xl tracking-widest text-white">
                用于Header块占位
            </div>
            <div className="flex flex-auto bg-pink-50">
                <div className="flex w-[24rem] space-y-0.5 flex-col bg-slate-200 px-1 py-1">
                    {/* 模型面板基本信息 */}
                    <div className="flex flex-col gap-0.5">
                        <div className="flex h-10 items-center border border-slate-300 bg-white px-2">
                            <div className="mr-1">当前模型案例：</div>
                            {projectName == null ? (
                                <span className="text-slate-500">暂未选择案例</span>
                            ) : (
                                <span className="text-blue-500">{projectName}</span>
                            )}
                        </div>
                        <div className="flex h-10 items-center border border-slate-300 bg-white px-2">
                            <div>模型类型: </div>
                            <div className="relative left-4 text-blue-500">FVCOM耦合模型</div>
                        </div>
                    </div>
                    {/* 模型设置和图层控制 */}
                    <div className="flex flex-1 flex-col gap-1 min-h-0">
                        <FvcomSetting />
                        <FvcomLayer />
                    </div>
                </div>
                <div className="relative h-full w-full">
                    <FvcomMap />
                    <TaskPanel isOpen={isPanelOpen} onToggle={() => setIsPanelOpen((prev) => !prev)} />
                </div>
            </div>
        </div>
    )
}
