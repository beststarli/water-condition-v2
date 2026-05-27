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

    // 单个案例查询
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

                // 查询 case 当前文件列表，判断是否同名替换
                const record = await fvcomService.getCase(caseID)
                const existingKeys = record?.filePaths ?? []
                const oldKey = existingKeys.find((k) => k.endsWith(`/${filename}`))

                if (oldKey) {
                    // 删除 RustFS 上的旧文件
                    await rustfs.delete(oldKey).catch(() => {})
                    replacedOldKeys.push(oldKey)
                }

                await rustfs.upload(key, file.file)
                newKeys.push(key)
            }

            if (!caseID) throw new Error('caseID is required')

            // 批量更新 DB：移除旧 key，添加新 key
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

    // 查询案例渲染纹理列表 — 计算后端将纹理上传到 RustFS 后，中台从此接口获取
    app.route({
        method: 'GET',
        url: '/textures/:caseID',
        handler: async (req) => {
            const { caseID } = req.params as { caseID: string }

            const caseInfo = await fvcomService.getCase(caseID)
            if (!caseInfo) {
                return generateResponse('error', '案例不存在', null)
            }

            const prefix = `fvcom/${caseID}/textures/`
            const objects = await rustfs.listObjects(prefix)

            const textures = objects
                .filter((obj) => obj.key !== prefix) // 排除目录本身
                .map((obj) => ({
                    key: obj.key,
                    name: obj.key.split('/').pop() || obj.key,
                    url: `/api/v1/fvcom/download?key=${encodeURIComponent(obj.key)}`,
                    publicUrl: rustfs.getUrl(obj.key),
                    size: obj.size,
                }))

            return generateResponse('success', '', {
                caseID,
                bounds: caseInfo.areaBounds,
                textures,
            })
        },
    })

    // =============================================
    // 模型计算与 SSE 进度推送
    // TODO: 以下 mock 需替换为对真实 FVCOM 计算后端的 HTTP 调用
    //       计算后端通过中台的下载接口获取输入文件:
    //       GET http://<中台地址>/api/v1/fvcom/download?key=<fileKey>
    // =============================================

    // Mock — 模拟计算后端进度更新
    // TODO: 删除此函数，改为调用计算后端的真实 API
    const mockIntervals = new Map<string, NodeJS.Timeout>()
    const startMockComputation = (caseID: string) => {
        let step = 0
        const interval = setInterval(() => {
            step++
            const progress = Math.min(1, step * 0.06 + Math.random() * 0.02)

            const messages = [
                '模型初始化中...',
                '网格生成中...',
                '边界条件计算中...',
                'FVCOM 核心求解中...',
                '结果后处理中...',
            ]
            const msgIdx = Math.min(Math.floor(step / 4), messages.length - 1)

            let status = 'running'
            if (progress >= 1) {
                status = 'completed'
                clearInterval(interval)
                mockIntervals.delete(caseID)
            }

            // 同步更新 DB 中的进度与状态
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

    // 启动模型计算 — 计算后端只需 caseID，文件从中台下载
    app.route({
        method: 'POST',
        url: '/execute',
        handler: async (req) => {
            const { caseID } = req.body as { caseID: string }
            if (!caseID) {
                return generateResponse('error', 'caseID is required', null)
            }

            // 更新状态
            await fvcomService.updateCaseProgress(caseID, 0, 'running')

            // TODO: 调用计算后端启动模型:
            //   POST http://<computation-backend>/api/v1/model/start
            //   Body: { caseID }
            //   计算后端通过以下接口从中台获取数据:
            //   1. GET {baseUrl}/case/{caseID}      — 获取案例信息及 fileKeys
            //   2. GET {baseUrl}/download?key={key}  — 下载具体文件
            //   baseUrl 由部署环境配置（开发: http://localhost:3456/api/v1/fvcom）
            startMockComputation(caseID)

            return generateResponse('success', '模型计算已启动', { caseID })
        },
    })

    // SSE — 即时推送计算进度
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
                // TODO: 替换为真正的 HTTP 请求:
                //   GET http://<computation-backend>/api/v1/model/progress?caseID=${caseID}
                //   计算后端通过 GET /api/v1/fvcom/download?key=<fileKey> 下载输入文件
                const task = await fvcomService.getCase(caseID)

                if (!task) {
                    reply.raw.write(
                        `data: ${JSON.stringify({ progress: 0, status: 'running', message: '等待计算启动...' })}\n\n`,
                    )
                    return
                }

                reply.raw.write(
                    `data: ${JSON.stringify({
                        progress: task.progress,
                        status: task.status,
                        message:
                            task.status === 'completed'
                                ? '模型计算完成'
                                : task.status === 'error'
                                  ? '计算过程发生错误'
                                  : `计算中 ${Math.round(task.progress * 100)}%`,
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

    // SSE — 任务面板统一推送所有活跃案例状态（事件驱动，无轮询）
    app.route({
        method: 'GET',
        url: '/progress/tasks',
        handler: async (req, reply) => {
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            })

            // 立即推送当前状态
            const sendActiveCases = async () => {
                const cases = await fvcomService.getAllCases()
                const activeCases = cases.filter(
                    (c) => c.status === 'running' || c.status === 'completed',
                )
                reply.raw.write(`data: ${JSON.stringify(activeCases)}\n\n`)
            }
            await sendActiveCases()

            // 后续仅在状态变更时推送
            const onProgress = () => sendActiveCases()
            fvcomEventBus.on(FvcomEvent.CASE_PROGRESS, onProgress)

            req.raw.on('close', () => {
                fvcomEventBus.off(FvcomEvent.CASE_PROGRESS, onProgress)
            })
        },
    })
}
