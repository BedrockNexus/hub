export {
	AMBIGUITY_SCORE_MARGIN,
	CONFIDENT_ADAPTER_SCORE,
	confidenceForScore,
	resolveAdapterDetections,
} from './confidence'
export {
	detectCompatibleAdapters,
	getAdapterById,
	getEnabledAdapters,
} from './registry'
export { createRepositorySnapshot } from './repository'
export type {
	AdapterConfidence,
	AdapterDetection,
	AdapterId,
	AdapterIssue,
	AdapterMetadata,
	AdapterMetadataResult,
	AdapterResolution,
	AdapterValidation,
	BuildSystem,
	DetectionSignal,
	GeneratedWorkflow,
	PluginAdapter,
	RepositoryFile,
	RepositorySnapshot,
} from './types'
