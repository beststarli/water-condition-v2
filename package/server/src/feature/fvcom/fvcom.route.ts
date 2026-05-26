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
import { fvcomEventBus, FvcomEvent } from './fvcom.event'
import { generateResponse } from '@/util/typebox'
import { rustfs } from '@/util/rustfs'
import { orm } from '@/dao'

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
                    stopMockComputation(caseID)
                    await fvcomService.updateCaseProgress(caseID, 0, 'idle')
                    return null
                },
            }
            const result = await actionFunctionsMap[action]()
            const response = generateResponse('success', 'fvcom案例操作成功', result)
            return response
        },
    })

    // 文件上传 — 保存到 RustFS，关联 caseID，持久化到数据库
    app.route({
        method: 'POST',
        url: '/upload',
        handler: async (req) => {
            const files = req.files()
            let caseID: string | undefined
            const newKeys: string[] = []
            const replacedOldKeys: string[] = []

            for await (const file of files) {
                if (!caseID) {
                    caseID = (file.fields.caseID as any)?.value
                    if (!caseID) throw new Error('caseID is required')
                }

                const filename = file.filename
                const key = `fvcom/${caseID}/${filename}`

                // 查詢 case 當前文件列表，判斷是否同名替換
                const record = await fvcomService.getCase(caseID)
                const existingKeys = record?.filePaths ?? []
                const oldKey = existingKeys.find((k) => k.endsWith(`/${filename}`))

                if (oldKey) {
                    // 刪除 RustFS 上的舊文件
                    await rustfs.delete(oldKey).catch(() => {})
                    replacedOldKeys.push(oldKey)
                }

                await rustfs.upload(key, file.file)
                newKeys.push(key)
            }

            if (!caseID) throw new Error('caseID is required')

            // 批量更新 DB：移除舊 key，添加新 key
            await orm.fvcom.replaceCaseFiles(caseID, replacedOldKeys, newKeys)

            // 返回最新的文件列表
            const updated = await fvcomService.getCase(caseID)
            return generateResponse('success', '', updated?.filePaths ?? [])
        },
    })

    // 文件下载 — 中台从 RustFS 拉取文件流式返回（计算后端调用此接口获取输入文件）
    app.route({
        method: 'GET',
        url: '/download',
        handler: async (req, reply) => {
            const { key } = req.query as { key: string }
            if (!key) {
                return reply.code(400).send({ error: 'key is required' })
            }

            const stream = await rustfs.download(key)
            if (!stream) {
                return reply.code(404).send({ error: 'file not found' })
            }

            const filename = key.split('/').pop() || 'download'
            reply.raw.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
            })
            stream.pipe(reply.raw)
        },
    })

    // 删除文件 — 从 RustFS 和数据库中移除
    app.route({
        method: 'POST',
        url: '/delete-file',
        handler: async (req) => {
            const { caseID, key } = req.body as { caseID: string; key: string }
            if (!caseID || !key) {
                return generateResponse('error', 'caseID and key are required', null)
            }

            await rustfs.delete(key).catch(() => {})
            await orm.fvcom.removeCaseFile(caseID, key)

            const updated = await fvcomService.getCase(caseID)
            return generateResponse('success', '', updated?.filePaths ?? [])
        },
    })

    // =============================================
    // 模型計算與 SSE 進度推送
    // TODO: 以下 mock 需替換為對真實 FVCOM 計算後端的 HTTP 呼叫
    //       計算後端通過中台的下載接口獲取輸入文件:
    //       GET http://<中台地址>/api/v1/fvcom/download?key=<fileKey>
    // =============================================

    // Mock — 模擬計算後端進度更新
    // TODO: 刪除此函數，改為呼叫計算後端的真實 API
    const mockIntervals = new Map<string, NodeJS.Timeout>()
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
                mockIntervals.delete(caseID)
            }

            // 同步更新 DB 中的進度與狀態
            fvcomService.updateCaseProgress(caseID, progress, status)

            if (progress >= 1) {
                fvcomService.updateCaseProgress(caseID, 1, 'completed')
            }
        }, 2000)
        mockIntervals.set(caseID, interval)
    }

    const stopMockComputation = (caseID: string) => {
        const interval = mockIntervals.get(caseID)
        if (interval) {
            clearInterval(interval)
            mockIntervals.delete(caseID)
        }
    }

    // 啟動模型計算 — 计算后端只需 caseID，文件从中台下载
    app.route({
        method: 'POST',
        url: '/execute',
        handler: async (req) => {
            const { caseID } = req.body as { caseID: string }
            if (!caseID) {
                return generateResponse('error', 'caseID is required', null)
            }

            // 更新狀態
            await fvcomService.updateCaseProgress(caseID, 0, 'running')

            // TODO: 呼叫計算後端啟動模型:
            //   POST http://<computation-backend>/api/v1/model/start
            //   Body: { caseID }
            //   计算后端通过以下接口从中台获取数据:
            //   1. GET {baseUrl}/case/{caseID}      — 获取案例信息及 fileKeys
            //   2. GET {baseUrl}/download?key={key}  — 下载具体文件
            //   baseUrl 由部署环境配置（开发: http://localhost:3456/api/v1/fvcom）
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
                //   计算后端通过 GET /api/v1/fvcom/download?key=<fileKey> 下载输入文件
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

    // SSE — 任務面板統一推送所有活躍案例狀態（事件驅動，無輪詢）
    app.route({
        method: 'GET',
        url: '/progress/tasks',
        handler: async (req, reply) => {
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            })

            // 立即推送當前狀態
            const sendActiveCases = async () => {
                const cases = await fvcomService.getAllCases()
                const activeCases = cases.filter(
                    (c) => c.status === 'running' || c.status === 'completed',
                )
                reply.raw.write(`data: ${JSON.stringify(activeCases)}\n\n`)
            }
            await sendActiveCases()

            // 後續僅在狀態變更時推送
            const onProgress = () => sendActiveCases()
            fvcomEventBus.on(FvcomEvent.CASE_PROGRESS, onProgress)

            req.raw.on('close', () => {
                fvcomEventBus.off(FvcomEvent.CASE_PROGRESS, onProgress)
            })
        },
    })
}
