import { Type, Static } from '@sinclair/typebox'
import { generateResponseSchema } from '@/util/typebox'

export const CaseActionSchema = Type.Union([Type.String(), Type.Null()])

export const FvcomCaseItemSchema = Type.Object({
    caseID: Type.String(),
    caseName: Type.String(),
    areaBounds: Type.Tuple([
        Type.Number(),
        Type.Number(),
        Type.Number(),
        Type.Number(),
    ]),
    filePaths: Type.Array(Type.String()),
    status: Type.String(),
    progress: Type.Number(),
})

export const FvcomCaseListSchema = Type.Array(FvcomCaseItemSchema)

export const FvcomCaseActionReqSchema = Type.Object({
    action: Type.Union([Type.Literal('create'), Type.Literal('delete'), Type.Literal('reset')]),
    caseID: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    caseName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    caseBounds: Type.Optional(Type.Union([Type.Array(Type.Number()), Type.Null()])),
})


export const FvcomCaseActionResSchema = generateResponseSchema(CaseActionSchema)
export type FvcomCaseActionResType = Static<typeof FvcomCaseActionResSchema>

export const FvcomCaseListResSchema = generateResponseSchema(FvcomCaseListSchema)
export type FvcomCaseListResType = Static<typeof FvcomCaseListResSchema>