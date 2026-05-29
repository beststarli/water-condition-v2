import { useFvcomStore } from '@/store/FvcomStroe'

export default function FvcomLayer() {
    const texture = useFvcomStore((state) => state.texture)
    const hasTextures = texture.textures.length > 0
    const testTextureEnabled = useFvcomStore((state) => state.testTextureEnabled)
    const setTestTextureEnabled = useFvcomStore((state) => state.setTestTextureEnabled)

    const flowChecked = texture.flowVisible
    const meshChecked = texture.meshVisible

    // 分组纹理列表
    const uvTextures = texture.textures.filter((t) => /^uv/i.test(t.name))
    const meshTextures = texture.textures.filter((t) => /^mesh/i.test(t.name))
    const otherTextures = texture.textures.filter(
        (t) => !/^uv/i.test(t.name) && !/^mesh/i.test(t.name),
    )

    return (
        <div className="flex flex-1 max-h-[43vh] flex-col border border-slate-300 bg-white">
            <div className="border-b border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-700">
                图层控制面板
            </div>

            {!hasTextures ? (
                <div className="flex flex-1 flex-col items-center justify-center text-sm text-slate-400">
                    <span>暂无可视化资源</span>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto px-2 py-2 text-xs text-slate-600 space-y-2">
                    {/* 流场渲染图层 */}
                    {uvTextures.length > 0 && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={flowChecked}
                                onChange={() => texture.setFlowVisible(!flowChecked)}
                                className="h-3.5 w-3.5 accent-[#135eb0]"
                            />
                            <span className="font-medium">流场动画</span>
                            <span className="ml-auto text-slate-400">
                                {uvTextures.length} 层
                            </span>
                        </label>
                    )}

                    {/* 网格纹理图层 */}
                    {meshTextures.length > 0 && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={meshChecked}
                                onChange={() => texture.setMeshVisible(!meshChecked)}
                                className="h-3.5 w-3.5 accent-[#135eb0]"
                            />
                            <span className="font-medium">网格纹理</span>
                            <span className="ml-auto text-slate-400">
                                {meshTextures.length} 层
                            </span>
                        </label>
                    )}

                    {/* 其他纹理列表 */}
                    {otherTextures.length > 0 && (
                        <div className="border-t border-slate-200 pt-2">
                            <div className="mb-1 px-2 text-slate-400">其他资源</div>
                            {otherTextures.map((t) => (
                                <div
                                    key={t.key}
                                    className="flex items-center gap-2 rounded-md px-2 py-1 text-slate-500"
                                >
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span className="truncate">{t.name}</span>
                                    <span className="ml-auto shrink-0">
                                        {(t.size / 1024).toFixed(0)} KB
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 说明 */}
                    <div className="border-t border-slate-200 pt-2 text-slate-400">
                        <div className="px-2">文本框边界：{texture.bounds?.join(', ') ?? '-'}</div>
                    </div>
                </div>
            )}

            {/* 本地测试纹理 — 始终可见 */}
            <div className="border-t border-slate-200 px-2 py-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
                    <input
                        type="checkbox"
                        checked={testTextureEnabled}
                        onChange={() => setTestTextureEnabled(!testTextureEnabled)}
                        className="h-3.5 w-3.5 accent-[#135eb0]"
                    />
                    <span className="font-medium text-amber-600">本地测试纹理</span>
                    <span className="ml-auto text-slate-400">data/texture</span>
                </label>
            </div>
        </div>
    )
}
