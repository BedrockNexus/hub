import { parse } from 'yaml'

import type { GeneratedWorkflow } from './types'

export const WORKFLOW_PATH =
	'.github/workflows/bedrocknexus-publish.yml' as const

/**
 * The checks every rendered workflow must pass before it is committed to a
 * plugin repository. The workflows themselves are written by admins in the
 * workflow editor (/admin/plugins/workflows); none ship with the code.
 */
export function assertValidGeneratedWorkflow(workflow: GeneratedWorkflow) {
	const parsed = parse(workflow.content) as {
		name?: unknown
		on?: unknown
		jobs?: unknown
	}

	if (parsed.name !== 'BedrockNexus Publish' || !parsed.on || !parsed.jobs) {
		throw new Error(
			'The generated workflow is missing its name, triggers, or jobs.',
		)
	}
	if (!workflow.content.includes("startsWith(github.ref, 'refs/tags/v')")) {
		throw new Error('The generated workflow must gate releases to v* tags.')
	}
	if (!workflow.content.includes('gh release create')) {
		throw new Error(
			'The generated workflow must create a permanent GitHub Release.',
		)
	}
	if (workflow.path !== WORKFLOW_PATH) {
		throw new Error('The generated workflow path is not canonical.')
	}

	return workflow
}
