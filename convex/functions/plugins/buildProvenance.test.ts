import { describe, expect, it } from 'vitest'

import {
	evaluateBuildProvenance,
	WORKFLOW_BOT_LOGIN,
} from '../../lib/plugins/buildProvenance'

const startedAt = Date.UTC(2026, 9, 1, 12, 0, 0)
const completedAt = startedAt + 5 * 60 * 1000

function evidence() {
	return {
		installedWorkflowBlobSha: 'blob-installed',
		run: {
			status: 'completed',
			conclusion: 'success',
			commitSha: 'commit-1',
			tag: 'v1.0.0',
			startedAt,
			completedAt,
		},
		release: {
			tag: 'v1.0.0',
			commitSha: 'commit-1',
			asset: { size: 1024 },
			provenance: {
				releaseAuthor: WORKFLOW_BOT_LOGIN,
				assetUploader: WORKFLOW_BOT_LOGIN,
				assetCreatedAt: startedAt + 4 * 60 * 1000,
				workflowBlobShaAtCommit: 'blob-installed',
			},
		},
	}
}

describe('build provenance', () => {
	it('verifies a release built and uploaded by the managed workflow run', () => {
		expect(evaluateBuildProvenance(evidence())).toEqual({ verified: true })
	})

	it('rejects an asset uploaded by a person', () => {
		const input = evidence()
		input.release.provenance.assetUploader = 'maintainer'
		expect(evaluateBuildProvenance(input)).toEqual({
			verified: false,
			reason: 'ASSET_NOT_UPLOADED_BY_WORKFLOW',
		})
	})

	it('rejects a release created by a person', () => {
		const input = evidence()
		input.release.provenance.releaseAuthor = 'maintainer'
		expect(evaluateBuildProvenance(input)).toEqual({
			verified: false,
			reason: 'RELEASE_NOT_CREATED_BY_WORKFLOW',
		})
	})

	it('rejects an asset replaced after the run finished', () => {
		const input = evidence()
		input.release.provenance.assetCreatedAt = completedAt + 60 * 60 * 1000
		expect(evaluateBuildProvenance(input)).toEqual({
			verified: false,
			reason: 'ASSET_OUTSIDE_RUN',
		})
	})

	it('rejects a workflow edited at the release commit', () => {
		const input = evidence()
		input.release.provenance.workflowBlobShaAtCommit = 'blob-edited'
		expect(evaluateBuildProvenance(input)).toEqual({
			verified: false,
			reason: 'WORKFLOW_MODIFIED',
		})
	})

	it('requires a pinned workflow installation', () => {
		expect(
			evaluateBuildProvenance({
				...evidence(),
				installedWorkflowBlobSha: undefined,
			}),
		).toEqual({ verified: false, reason: 'WORKFLOW_NOT_PINNED' })
	})

	it('rejects a run for a different commit or tag', () => {
		const input = evidence()
		input.run.commitSha = 'other'
		expect(evaluateBuildProvenance(input)).toEqual({
			verified: false,
			reason: 'RUN_RELEASE_MISMATCH',
		})
	})

	it('rejects unsuccessful runs', () => {
		const input = evidence()
		input.run.conclusion = 'failure'
		expect(evaluateBuildProvenance(input)).toEqual({
			verified: false,
			reason: 'RUN_NOT_SUCCESSFUL',
		})
	})
})
