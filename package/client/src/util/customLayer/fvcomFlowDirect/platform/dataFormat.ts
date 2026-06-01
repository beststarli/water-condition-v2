export const ScratchDataFormat = {
    R8G8B8A8_UBYTE: 0,
    R32_SFLOAT: 1,
    R32G32_SFLOAT: 2,
    R32G32B32_SFLOAT: 3,
    R32G32B32A32_SFLOAT: 4,
    Format_Num: 5,
} as const

export interface DataFormat {
    internalFormat: number,
    format: number,
    type: number,
    components: number,
    dataType: "Integer" | "Float_Point" 
    size: number
}

export interface DataFormats {
    [formatName: number]: DataFormat
}
