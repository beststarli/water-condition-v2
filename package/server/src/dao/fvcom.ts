import { prisma } from '@/util/db/prisma'

export const fvcomDao = {
    createCase: async (
        caseID: string,
        caseName: string,
        areaBounds: [number, number, number, number],
    ) => {
        await prisma.renamedcase.create({
            data: {
                case_id: caseID,
                case_name: caseName,
                area_bounds: areaBounds,
            }
        })
    },

    deleteCase: async (caseID: string) => {
        await prisma.renamedcase.delete({
            where: {
                case_id: caseID,
            }
        })
    },

    getAllCases: async () => {
        const caseList = await prisma.renamedcase.findMany()
        return caseList
    }
}