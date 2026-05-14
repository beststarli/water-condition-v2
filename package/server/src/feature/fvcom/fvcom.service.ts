import { orm } from "@/dao"
import { fvcomEventBus, FvcomEvent } from "./fvcom.event"

export const fvcomService = {
    createCase: async (
        caseID: string,
        caseName: string,
        areaBounds: [number, number, number, number],
    ) => {
        await orm.fvcom.createCase(caseID, caseName, areaBounds)
    },

    deleteCase: async (caseID: string) => {
        await orm.fvcom.deleteCase(caseID)
    },

    getAllCases: async () => {
        const caseList = await orm.fvcom.getAllCases()
        const result = caseList.map((item) => ({
            caseID: item.case_id,
            caseName: item.case_name,
            areaBounds: item.area_bounds as [number, number, number, number],
            filePaths: item.file_paths,
            status: item.status,
            progress: item.progress,
        }))
        return result
    },

    getCase: async (caseID: string) => {
        const item = await orm.fvcom.getCaseByCaseID(caseID)
        if (!item) return null
        return {
            caseID: item.case_id,
            caseName: item.case_name,
            areaBounds: item.area_bounds as [number, number, number, number],
            filePaths: item.file_paths,
            status: item.status,
            progress: item.progress,
        }
    },

    updateCaseFiles: async (caseID: string, filePaths: string[]) => {
        await orm.fvcom.updateCaseFiles(caseID, filePaths)
    },

    updateCaseProgress: async (caseID: string, progress: number, status: string) => {
        await orm.fvcom.updateCaseProgress(caseID, progress, status)
        fvcomEventBus.emit(FvcomEvent.CASE_PROGRESS, { caseID, progress, status })
    },
}