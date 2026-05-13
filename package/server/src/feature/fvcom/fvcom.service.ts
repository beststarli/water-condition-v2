import { orm } from "@/dao"

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
        }))
        return result
    }
}