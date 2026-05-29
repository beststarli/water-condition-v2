import { create } from 'zustand'

export type TextureLayerType = {
    key: string
    name: string
    url: string
    publicUrl: string
    size: number
}

export interface FvcomTextureState {
    textures: TextureLayerType[]
    bounds: [number, number, number, number] | null
    flowVisible: boolean
    meshVisible: boolean
    setTextures: (textures: TextureLayerType[], bounds: [number, number, number, number]) => void
    clearTextures: () => void
    setFlowVisible: (v: boolean) => void
    setMeshVisible: (v: boolean) => void
}

interface FvcomStoreProps {
    projectName: string | null
    isCreateModalOpen: boolean
    createCaseName: string
    areaBounds: {
        minLng: string
        minLat: string
        maxLng: string
        maxLat: string
    }
    fitBoundsRequestId: number
    fitBoundsPayload: FvcomStoreProps['areaBounds'] | null
    isSelectingBounds: boolean
    setProjectName: (value: string | null) => void
    setIsCreateModalOpen: (value: boolean) => void
    setCreateCaseName: (value: string) => void
    setAreaBounds: (value: Partial<FvcomStoreProps['areaBounds']>) => void
    requestFitBounds: (bounds: FvcomStoreProps['areaBounds']) => void
    setIsSelectingBounds: (value: boolean) => void

    // 当前选中的案例
    selectedCaseID: string | null
    selectedCaseName: string | null
    selectedFilePaths: string[]
    selectedCaseBounds: [number, number, number, number] | null
    setCurrentCase: (caseID: string, caseName: string, filePaths: string[], caseBounds: [number, number, number, number]) => void
    clearCurrentCase: () => void

    // 任务面板刷新信号
    taskRefreshTrigger: number
    triggerTaskRefresh: () => void

    // 任务面板关注列表（仅显示由当前页面发起的任务）
    watchedTaskIds: string[]
    addWatchedTaskId: (id: string) => void
    removeWatchedTaskId: (id: string) => void

    // 执行按钮状态刷新信号（取消任务时触发）
    executingRefreshTrigger: number
    triggerExecutingRefresh: () => void

    // 纹理图层
    texture: FvcomTextureState

    // 纹理刷新信号（计算完成后重新加载纹理）
    textureRefreshTrigger: number
    triggerTextureRefresh: () => void

    // 本地测试纹理模式
    testTextureEnabled: boolean
    setTestTextureEnabled: (v: boolean) => void
}

const initialTextureState: FvcomTextureState = {
    textures: [],
    bounds: null,
    flowVisible: true,
    meshVisible: true,
    setTextures: () => {},
    clearTextures: () => {},
    setFlowVisible: () => {},
    setMeshVisible: () => {},
}

export const useFvcomStore = create<FvcomStoreProps>((set) => ({
    projectName: null,
    isCreateModalOpen: false,
    createCaseName: '',
    areaBounds: {
        minLng: '',
        minLat: '',
        maxLng: '',
        maxLat: '',
    },
    fitBoundsRequestId: 0,
    fitBoundsPayload: null,
    isSelectingBounds: false,
    setProjectName: (value) => set({ projectName: value }),
    setIsCreateModalOpen: (value) => set({ isCreateModalOpen: value }),
    setCreateCaseName: (value) => set({ createCaseName: value }),
    setAreaBounds: (value) =>
        set((state) => ({
            areaBounds: {
                ...state.areaBounds,
                ...value,
            },
        })),
    requestFitBounds: (bounds) =>
        set((state) => ({
            fitBoundsRequestId: state.fitBoundsRequestId + 1,
            fitBoundsPayload: bounds,
        })),
    setIsSelectingBounds: (value) => set({ isSelectingBounds: value }),

    // 当前选中的案例
    selectedCaseID: null,
    selectedCaseName: null,
    selectedFilePaths: [],
    selectedCaseBounds: null,
    setCurrentCase: (caseID, caseName, filePaths, caseBounds) =>
        set({
            selectedCaseID: caseID,
            selectedCaseName: caseName,
            selectedFilePaths: filePaths,
            selectedCaseBounds: caseBounds,
            projectName: caseName,
        }),
    clearCurrentCase: () =>
        set({
            selectedCaseID: null,
            selectedCaseName: null,
            selectedFilePaths: [],
            selectedCaseBounds: null,
        }),
    taskRefreshTrigger: 0,
    triggerTaskRefresh: () =>
        set((state) => ({ taskRefreshTrigger: state.taskRefreshTrigger + 1 })),
    watchedTaskIds: [],
    addWatchedTaskId: (id) =>
        set((state) => ({
            watchedTaskIds: state.watchedTaskIds.includes(id)
                ? state.watchedTaskIds
                : [...state.watchedTaskIds, id],
        })),
    removeWatchedTaskId: (id) =>
        set((state) => ({
            watchedTaskIds: state.watchedTaskIds.filter((i) => i !== id),
        })),
    executingRefreshTrigger: 0,
    triggerExecutingRefresh: () =>
        set((state) => ({ executingRefreshTrigger: state.executingRefreshTrigger + 1 })),

    // 纹理图层
    texture: {
        ...initialTextureState,
        setTextures: (textures, bounds) => set((state) => ({ texture: { ...state.texture, textures, bounds } })),
        clearTextures: () => set((state) => ({ texture: { ...state.texture, textures: [], bounds: null } })),
        setFlowVisible: (flowVisible) => set((state) => ({ texture: { ...state.texture, flowVisible } })),
        setMeshVisible: (meshVisible) => set((state) => ({ texture: { ...state.texture, meshVisible } })),
    },

    textureRefreshTrigger: 0,
    triggerTextureRefresh: () =>
        set((state) => ({ textureRefreshTrigger: state.textureRefreshTrigger + 1 })),

    testTextureEnabled: false,
    setTestTextureEnabled: (testTextureEnabled) => set({ testTextureEnabled }),
}))
