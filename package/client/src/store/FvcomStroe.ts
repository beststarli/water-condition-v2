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
    setCurrentCase: (caseID: string, caseName: string, filePaths: string[]) => void
    clearCurrentCase: () => void

    // 任務面板刷新信號
    taskRefreshTrigger: number
    triggerTaskRefresh: () => void
}

export const useFvcomStore = create<FvcomStoreProps>((set) => ({
    projectName: null,
    setProjectName: (value) => set({ projectName: value }),
    isCreateModalOpen: false,
    setIsCreateModalOpen: (value) => set({ isCreateModalOpen: value }),
    createCaseName: '',
    setCreateCaseName: (value) => set({ createCaseName: value }),
    areaBounds: {
        minLng: '',
        minLat: '',
        maxLng: '',
        maxLat: '',
    },
    setAreaBounds: (value) =>
        set((state) => ({
            areaBounds: {
                ...state.areaBounds,
                ...value,
            },
        })),
    fitBoundsRequestId: 0,
    fitBoundsPayload: null,
    requestFitBounds: (bounds) =>
        set((state) => ({
            fitBoundsRequestId: state.fitBoundsRequestId + 1,
            fitBoundsPayload: bounds,
        })),
    isSelectingBounds: false,
    setIsSelectingBounds: (value) => set({ isSelectingBounds: value }),

    // 當前選中的案例
    selectedCaseID: null,
    selectedCaseName: null,
    selectedFilePaths: [],
    setCurrentCase: (caseID, caseName, filePaths) =>
        set({
            selectedCaseID: caseID,
            selectedCaseName: caseName,
            selectedFilePaths: filePaths,
            projectName: caseName,
        }),
    clearCurrentCase: () =>
        set({
            selectedCaseID: null,
            selectedCaseName: null,
            selectedFilePaths: [],
        }),
    taskRefreshTrigger: 0,
    triggerTaskRefresh: () =>
        set((state) => ({ taskRefreshTrigger: state.taskRefreshTrigger + 1 })),
}))
