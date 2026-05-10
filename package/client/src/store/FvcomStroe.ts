import { create } from 'zustand'

interface FvcomStoreProps {
    projectName: string | null
    setProjectName: (value: string | null) => void
    isCreateModalOpen: boolean
    setIsCreateModalOpen: (value: boolean) => void
    createCaseName: string
    setCreateCaseName: (value: string) => void
    areaBounds: {
        minLng: string
        minLat: string
        maxLng: string
        maxLat: string
    }
    setAreaBounds: (value: Partial<FvcomStoreProps['areaBounds']>) => void
    fitBoundsRequestId: number
    fitBoundsPayload: FvcomStoreProps['areaBounds'] | null
    requestFitBounds: (bounds: FvcomStoreProps['areaBounds']) => void
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
}))