import { create } from 'zustand'

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

    // 當前選中的案例
    selectedCaseID: string | null
    selectedCaseName: string | null
    selectedFilePaths: string[]
    selectedCaseBounds: [number, number, number, number] | null
    setCurrentCase: (caseID: string, caseName: string, filePaths: string[], caseBounds: [number, number, number, number]) => void
    clearCurrentCase: () => void

    // 任務面板刷新信號
    taskRefreshTrigger: number
    triggerTaskRefresh: () => void

    // 任務面板關注列表（僅顯示由當前頁面發起的任務）
    watchedTaskIds: string[]
    addWatchedTaskId: (id: string) => void
    removeWatchedTaskId: (id: string) => void

    // 執行按鈕狀態刷新信號（取消任務時觸發）
    executingRefreshTrigger: number
    triggerExecutingRefresh: () => void
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

    // 當前選中的案例
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
}))
