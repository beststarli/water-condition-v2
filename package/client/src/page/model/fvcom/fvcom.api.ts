import { extendFetch } from '@/api/api.util'
import { DataFetchAPIInterface } from '@/type'

interface CreateCaseActionParams {
    action: 'create'
    caseID: string | null
    caseName: string
    caseBounds: [number, number, number, number]
}

export const createCaseActionAPI = async (
    params: CreateCaseActionParams,
): Promise<DataFetchAPIInterface<string>> => {
    const url = '/api/v1/fvcom/action'
    try {
        const response = await extendFetch(url, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                action: params.action,
                caseID: params.caseID,
                caseName: params.caseName,
                caseBounds: params.caseBounds,
            }),
        })

        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
        }

        const result = (await response.json()) as DataFetchAPIInterface<string>
        if (result.status !== 'success') {
            throw new Error(result.message || 'request failed')
        }

        return result
    } catch (error) {
        return {
            status: 'error',
            data: null,
            message: error instanceof Error ? error.message : '',
        }
    }
}

export const deleteCaseActionAPI = async (caseID: string) => {
    const url = '/api/v1/fvcom/action'
    try {
        const response = await extendFetch(url, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                action: 'delete',
                caseID: caseID,
            }),
        })
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
        }
        const result = (await response.json()) as DataFetchAPIInterface<null>
        if (result.status !== 'success') {
            throw new Error(result.message || 'request failed')
        }
        return result
    } catch (error) {
        return {
            status: 'error',
            data: null,
            message: error instanceof Error ? error.message : '',
        }
    }
}

export const getCaseListAPI = async () => {
    const url = '/api/v1/fvcom/list'
    try {
        const response = await extendFetch(url, {
            method: 'GET',
        })

        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
    } catch (error) {
        return {
            status: 'error',
            data: null,
            message: error instanceof Error ? error.message : '',
        }
    }
}

export const uploadFilesAPI = async (
    files: File[],
): Promise<DataFetchAPIInterface<string[]>> => {
    const url = '/api/v1/fvcom/upload'
    try {
        const formData = new FormData()
        files.forEach((file) => formData.append('files', file))

        const response = await extendFetch(url, {
            method: 'POST',
            body: formData,
        })

        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
        }

        const result = (await response.json()) as DataFetchAPIInterface<string[]>
        if (result.status !== 'success') {
            throw new Error(result.message || 'upload failed')
        }

        return result
    } catch (error) {
        return {
            status: 'error',
            data: null,
            message: error instanceof Error ? error.message : '',
        }
    }
}

// 重置案例狀態（取消任務）
export const resetCaseStatusAPI = async (caseID: string) => {
    const url = '/api/v1/fvcom/action'
    try {
        const response = await extendFetch(url, {
            method: 'POST',
            headers: new Headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ action: 'reset', caseID }),
        })
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
        }
        const result = (await response.json()) as DataFetchAPIInterface<null>
        if (result.status !== 'success') {
            throw new Error(result.message || 'reset failed')
        }
        return result
    } catch (error) {
        return {
            status: 'error',
            data: null,
            message: error instanceof Error ? error.message : '',
        }
    }
}

// 啟動模型計算
export const executeModelAPI = async (caseID: string, files: string[]) => {
    const url = '/api/v1/fvcom/execute'
    try {
        const response = await extendFetch(url, {
            method: 'POST',
            headers: new Headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ caseID, files }),
        })
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
        }
        return await response.json()
    } catch (error) {
        return {
            status: 'error',
            data: null,
            message: error instanceof Error ? error.message : '',
        }
    }
}

// 查詢單個案例詳情
export const getCaseDetailAPI = async (caseID: string) => {
    const url = `/api/v1/fvcom/case/${caseID}`
    try {
        const response = await extendFetch(url, { method: 'GET' })
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`)
        }
        return await response.json()
    } catch (error) {
        return {
            status: 'error',
            data: null,
            message: error instanceof Error ? error.message : '',
        }
    }
}
