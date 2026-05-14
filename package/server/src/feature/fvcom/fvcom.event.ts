import { EventEmitter } from 'events'

export type CaseProgressEvent = {
    caseID: string
    progress: number
    status: string
}

export const fvcomEventBus = new EventEmitter()
fvcomEventBus.setMaxListeners(100)

export const FvcomEvent = {
    CASE_PROGRESS: 'case:progress',
} as const
