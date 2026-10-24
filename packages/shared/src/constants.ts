// Enums and limits shared by web and api. Filled in as tables and features land.

export const WEIGHT_UNITS = ['kg', 'lb'] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]
