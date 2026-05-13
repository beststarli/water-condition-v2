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
import { DATA_FOLDER_PATH } from '@/config/env'
import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'

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

    // 获取全部案例
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

    // 單個案例查詢
    app.route({
        method: 'GET',
        url: '/case/:caseID',
        handler: async (req) => {
            const { caseID } = req.params as { caseID: string }
            const result = await fvcomService.getCase(caseID)
            if (!result) {
                return generateResponse('error', '案例不存在', null)
            }
            return generateResponse('success', '', result)
        },
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
                reset: async () => {
                    if (!caseID) {
                        throw Error('重置的案例ID为空')
                    }
                    await fvcomService.updateCaseProgress(caseID, 0, 'idle')
                    return null
                },
            }
            const result = await actionFunctionsMap[action]()
            const response = generateResponse('success', 'fvcom案例操作成功', result)
            return response
        },
    })

    // 文件上传 — 保存到中台文件系统，返回真实路径
    app.route({
        method: 'POST',
        url: '/upload',
        handler: async (req) => {
            const uploadDir = path.join(
                DATA_FOLDER_PATH,
                'fvcom',
                'uploads',
                Date.now().toString(),
            )
            await fs.mkdir(uploadDir, { recursive: true })
            const savedPaths: string[] = []

            const files = req.files()
            for await (const file of files) {
                const filePath = path.join(uploadDir, file.filename)
                await new Promise<void>((resolve, reject) => {
                    const writeStream = createWriteStream(filePath)
                    file.file.pipe(writeStream)
                    writeStream.on('finish', resolve)
                    writeStream.on('error', reject)
                })
                savedPaths.push(filePath)
            }

            return generateResponse('success', '', savedPaths)
        },
    })

    // =============================================
    // 模型計算與 SSE 進度推送 (Mock)
    // TODO: 以下 mock 需替換為對真實 FVCOM 計算後端的 HTTP 呼叫
    // =============================================

    // Mock — 模擬計算後端進度更新
    // TODO: 刪除此函數，改為呼叫計算後端的真實 API
    const startMockComputation = (caseID: string) => {
        let step = 0
        const interval = setInterval(() => {
            step++
            const progress = Math.min(1, step * 0.06 + Math.random() * 0.02)

            const messages = [
                '模型初始化中...',
                '網格生成中...',
                '邊界條件計算中...',
                'FVCOM 核心求解中...',
                '結果後處理中...',
            ]
            const msgIdx = Math.min(Math.floor(step / 4), messages.length - 1)

            let status = 'running'
            if (progress >= 1) {
                status = 'completed'
                clearInterval(interval)
            }

            // 同步更新 DB 中的進度與狀態
            fvcomService.updateCaseProgress(caseID, progress, status)

            if (progress >= 1) {
                fvcomService.updateCaseProgress(caseID, 1, 'completed')
            }
        }, 2000)
    }

    // 啟動模型計算
    app.route({
        method: 'POST',
        url: '/execute',
        handler: async (req) => {
            const { caseID, files } = req.body as {
                caseID: string
                files: string[]
            }

            // 儲存檔案路徑、更新狀態
            await fvcomService.updateCaseFiles(caseID, files)
            await fvcomService.updateCaseProgress(caseID, 0, 'running')

            // TODO: 呼叫計算後端啟動模型:
            //   POST http://<computation-backend>/api/v1/model/start
            //   Body: { caseID, files }
            startMockComputation(caseID)

            return generateResponse('success', '模型計算已啟動', { caseID })
        },
    })

    // SSE — 即時推送計算進度
    app.route({
        method: 'GET',
        url: '/progress/:caseID',
        handler: async (req, reply) => {
            const { caseID } = req.params as { caseID: string }

            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            })

            const pollInterval = setInterval(async () => {
                // TODO: 替換為真正的 HTTP 請求:
                //   GET http://<computation-backend>/api/v1/model/progress?caseID=${caseID}
                const task = await fvcomService.getCase(caseID)

                if (!task) {
                    reply.raw.write(
                        `data: ${JSON.stringify({ progress: 0, status: 'running', message: '等待計算啟動...' })}\n\n`,
                    )
                    return
                }

                reply.raw.write(
                    `data: ${JSON.stringify({
                        progress: task.progress,
                        status: task.status,
                        message:
                            task.status === 'completed'
                                ? '模型計算完成'
                                : task.status === 'error'
                                  ? '計算過程發生錯誤'
                                  : `計算中 ${Math.round(task.progress * 100)}%`,
                    })}\n\n`,
                )

                if (task.status === 'completed' || task.status === 'error') {
                    clearInterval(pollInterval)
                    reply.raw.end()
                }
            }, 2000)

            req.raw.on('close', () => {
                clearInterval(pollInterval)
            })
        },
    })
}
