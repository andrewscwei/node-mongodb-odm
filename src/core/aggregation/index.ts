export * from './group'
export * from './lookup'
export * from './match'
export * from './project'
export * from './sort'

export type PipelineStage = Record<string, Record<string, any>>

export type Pipeline = PipelineStage[]
