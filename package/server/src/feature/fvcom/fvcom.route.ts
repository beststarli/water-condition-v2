import { FastifyTypebox } from '@/type'
import {
    FvcomCaseActionReqSchema,
    FvcomCaseActionResSchema,
    FvcomCaseActionResType,
    FvcomCaseListResSchema,
    FvcomCaseListResType,
} from './fvcom.type'
import { randomUUID } from 'crypto'
import { fvcomService } from './fvcom.service'
import { generateResponse } from '@/util/typebox'

export const fvcomRoute = async (app: FastifyTypebox) => {
    // fvcom测试用接口
    app.route({
        method: 'GET',
        url: '/test',
        schema: {
        },
        handler: () => {
            return '你好'
        },
    })

    app.route({
        method: 'GET',
        url: '/list',
        schema: {
            tags: ['fvcom'],
            response: { 200: FvcomCaseListResSchema },
        },
        handler: async (): Promise<FvcomCaseListResType> => {
            const result = await fvcomService.getAllCases()
            const response = generateResponse('success', 'fvcom全部案例获取成功', result)
            return response
        }
    })

    // 案例创建接口
    app.route({
        method: 'POST',
        url: '/action',
        schema: {
            tags: ['fvcom'],
            body: FvcomCaseActionReqSchema,
            response: { 200: FvcomCaseActionResSchema },
        },
        handler: async (req): Promise<FvcomCaseActionResType> => {
            const { action, caseID, caseName, caseBounds } = req.body
            const actionFunctionsMap = {
                create: async () => {
                    const newCaseID = randomUUID()
                    if (!caseName) {
                        throw Error('创建的案例名称为空')
                    }

                    await fvcomService.createCase(
                        newCaseID,
                        caseName,
                        caseBounds as [number, number, number, number],
                    )
                    return newCaseID
                },
                delete: async () => {
                    if (!caseID) {
                        throw Error('删除的案例ID为空')
                    }
                    await fvcomService.deleteCase(caseID)
                    return null
                },
            }
            const result = await actionFunctionsMap[action]()
            const response = generateResponse('success', 'fvcom案例操作成功', result)
            return response
        },
    })
}