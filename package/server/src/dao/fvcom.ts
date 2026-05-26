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
                file_paths: [],
                status: 'idle',
                progress: 0,
            },
        })
    },

    deleteCase: async (caseID: string) => {
        await prisma.renamedcase.delete({
            where: {
                case_id: caseID,
            },
        })
    },

    getAllCases: async () => {
        const caseList = await prisma.renamedcase.findMany()
        return caseList
    },

    getCaseByCaseID: async (caseID: string) => {
        return prisma.renamedcase.findUnique({
            where: { case_id: caseID },
        })
    },

    updateCaseFiles: async (caseID: string, filePaths: string[]) => {
        await prisma.renamedcase.update({
            where: { case_id: caseID },
            data: { file_paths: filePaths },
        })
    },

    appendCaseFiles: async (caseID: string, newKeys: string[]) => {
        const record = await prisma.renamedcase.findUnique({
            where: { case_id: caseID },
            select: { file_paths: true },
        })
        const existing = record?.file_paths ?? []
        await prisma.renamedcase.update({
            where: { case_id: caseID },
            data: { file_paths: [...existing, ...newKeys] },
        })
    },

    removeCaseFile: async (caseID: string, key: string) => {
        const record = await prisma.renamedcase.findUnique({
            where: { case_id: caseID },
            select: { file_paths: true },
        })
        const existing = record?.file_paths ?? []
        await prisma.renamedcase.update({
            where: { case_id: caseID },
            data: { file_paths: existing.filter((k) => k !== key) },
        })
    },

    replaceCaseFiles: async (caseID: string, oldKeys: string[], newKeys: string[]) => {
        const record = await prisma.renamedcase.findUnique({
            where: { case_id: caseID },
            select: { file_paths: true },
        })
        const existing = record?.file_paths ?? []
        const oldSet = new Set(oldKeys)
        const filtered = existing.filter((k) => !oldSet.has(k))
        await prisma.renamedcase.update({
            where: { case_id: caseID },
            data: { file_paths: [...filtered, ...newKeys] },
        })
    },

    updateCaseProgress: async (caseID: string, progress: number, status: string) => {
        await prisma.renamedcase.update({
            where: { case_id: caseID },
            data: { progress, status },
        })
    },
}