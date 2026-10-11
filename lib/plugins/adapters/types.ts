export const ADAPTER_IDS = ['pocketmine-mp', 'powernukkitx'] as const

export type AdapterId = (typeof ADAPTER_IDS)[number]
export type AdapterConfidence = 'none' | 'low' | 'medium' | 'high'
export type BuildSystem = 'composer' | 'gradle' | 'maven'

export interface RepositoryFile {
	path: string
	content?: string
}

export interface RepositorySnapshot {
	fullName: string
	defaultBranch: string
	files: readonly RepositoryFile[]
}

export interface DetectionSignal {
	id: string
	label: string
	weight: number
	matched: boolean
	detail: string
	path?: string
}

export interface AdapterDetection {
	adapterId: AdapterId
	adapterName: string
	score: number
	confidence: AdapterConfidence
	signals: readonly DetectionSignal[]
	summary: string
}

export type AdapterResolution =
	| {
			kind: 'matched'
			selected: AdapterDetection
			candidates: readonly AdapterDetection[]
			explanation: string
	  }
	| {
			kind: 'ambiguous'
			candidates: readonly AdapterDetection[]
			explanation: string
	  }
	| {
			kind: 'unsupported'
			candidates: readonly AdapterDetection[]
			explanation: string
	  }

export interface AdapterMetadata {
	name: string
	version: string
	description?: string
	authors: readonly string[]
	website?: string
	license?: string
	apiVersions: readonly string[]
	mainClass: string
	buildSystem: BuildSystem
}

export type AdapterMetadataResult =
	| {
			ok: true
			metadata: AdapterMetadata
			sources: readonly string[]
	  }
	| {
			ok: false
			errors: readonly AdapterIssue[]
	  }

export type AdapterIssueSeverity = 'error' | 'warning'

export interface AdapterIssue {
	code: string
	severity: AdapterIssueSeverity
	message: string
	path?: string
}

export interface AdapterValidation {
	valid: boolean
	issues: readonly AdapterIssue[]
}

export interface BuildCommandOverride {
	command: string
	userConfirmed: boolean
}

export interface WorkflowGenerationInput {
	metadata: AdapterMetadata
	defaultBranch: string
	buildCommandOverride?: BuildCommandOverride
}

export interface GeneratedWorkflow {
	path: '.github/workflows/bedrocknexus-publish.yml'
	content: string
	buildCommand: string
	releaseAssetPattern: string
}

export interface PluginAdapter {
	readonly id: AdapterId
	readonly name: string
	readonly enabled: boolean
	detect(snapshot: RepositorySnapshot): AdapterDetection
	extractMetadata(snapshot: RepositorySnapshot): AdapterMetadataResult
	validate(snapshot: RepositorySnapshot): AdapterValidation
	generateWorkflow(input: WorkflowGenerationInput): GeneratedWorkflow
}
