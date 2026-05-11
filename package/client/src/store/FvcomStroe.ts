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
}))