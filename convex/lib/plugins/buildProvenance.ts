/**
 * Rules for the "Traceable build" badge. A release is traceable only when the
 * evidence ties its primary asset to a successful run of the exact managed
 * workflow at the release commit:
 *
 * - the managed workflow file at the tagged commit is byte-identical to the
 *   one BedrockNexus installed (same git blob SHA), so its build and release
 *   steps were not edited;
 * - the run that built the tag succeeded for that same tag and commit;
 * - the GitHub Release and its asset were both created by the workflow token
 *   (`github-actions[bot]`), not uploaded by a person;
 * - the asset was uploaded while that run was executing, so it was not
 *   replaced afterwards (replacing an asset creates a new one).
 *
 * This is build provenance, not a security review of the plugin's code.
 */

export const WORKFLOW_BOT_LOGIN = 'github-actions[bot]'

/** Clock skew allowed between GitHub's run and asset timestamps. */
const RUN_WINDOW_SLACK_MS = 2 * 60 * 1000

export type ProvenanceRun = {
	status: string
	conclusion?: string
	commitSha: string
	tag?: string
	startedAt?: number
	completedAt?: number
}

export type ProvenanceRelease = {
	tag: string
	commitSha: string
	asset: { size: number }
	provenance?: {
		releaseAuthor?: string
		assetUploader?: string
		assetCreatedAt?: number
		workflowBlobShaAtCommit?: string
	}
}

export type ProvenanceFailure =
	| 'RUN_NOT_SUCCESSFUL'
	| 'RUN_RELEASE_MISMATCH'
	| 'EMPTY_ASSET'
	| 'WORKFLOW_NOT_PINNED'
	| 'WORKFLOW_MODIFIED'
	| 'RELEASE_NOT_CREATED_BY_WORKFLOW'
	| 'ASSET_NOT_UPLOADED_BY_WORKFLOW'
	| 'ASSET_OUTSIDE_RUN'

export function evaluateBuildProvenance(args: {
	installedWorkflowBlobSha?: string
	run?: ProvenanceRun
	release?: ProvenanceRelease
}): { verified: true } | { verified: false; reason: ProvenanceFailure } {
	const { run, release } = args
	if (run?.status !== 'completed' || run.conclusion !== 'success') {
		return { verified: false, reason: 'RUN_NOT_SUCCESSFUL' }
	}
	if (
		!release ||
		run.tag !== release.tag ||
		run.commitSha !== release.commitSha
	) {
		return { verified: false, reason: 'RUN_RELEASE_MISMATCH' }
	}
	if (release.asset.size <= 0) {
		return { verified: false, reason: 'EMPTY_ASSET' }
	}
	if (!args.installedWorkflowBlobSha) {
		return { verified: false, reason: 'WORKFLOW_NOT_PINNED' }
	}
	const provenance = release.provenance
	if (provenance?.workflowBlobShaAtCommit !== args.installedWorkflowBlobSha) {
		return { verified: false, reason: 'WORKFLOW_MODIFIED' }
	}
	if (provenance.releaseAuthor !== WORKFLOW_BOT_LOGIN) {
		return { verified: false, reason: 'RELEASE_NOT_CREATED_BY_WORKFLOW' }
	}
	if (provenance.assetUploader !== WORKFLOW_BOT_LOGIN) {
		return { verified: false, reason: 'ASSET_NOT_UPLOADED_BY_WORKFLOW' }
	}
	if (
		provenance.assetCreatedAt === undefined ||
		run.startedAt === undefined ||
		run.completedAt === undefined ||
		provenance.assetCreatedAt < run.startedAt - RUN_WINDOW_SLACK_MS ||
		provenance.assetCreatedAt > run.completedAt + RUN_WINDOW_SLACK_MS
	) {
		return { verified: false, reason: 'ASSET_OUTSIDE_RUN' }
	}
	return { verified: true }
}
