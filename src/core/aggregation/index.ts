export * from './group.js'
export * from './lookup.js'
export * from './match.js'
export * from './project.js'
export * from './sort.js'

export type PipelineStage = Record<string, Record<string, any>>

export type Pipeline = PipelineStage[]
