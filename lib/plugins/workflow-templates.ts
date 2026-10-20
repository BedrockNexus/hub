import { parse } from 'yaml'

/**
 * Publishing workflows are written and versioned by admins in the workflow
 * editor (/admin/plugins/workflows) and stored in `pluginWorkflowTemplates`.
 * None ship with the code; this module only renders and checks them.
 *
 * A workflow builds the plugin on every push and uploads the file as a GitHub
 * Actions artifact named `plugin-package`. It never publishes anything itself:
 * BedrockNexus copies the artifact of the build a developer picks, and creates
 * the GitHub release after a moderator approves it.
 */

export const WORKFLOW_PATH =
	'.github/workflows/bedrocknexus-publish.yml' as const
export const WORKFLOW_NAME = 'BedrockNexus Publish'
export const PACKAGE_NAME_PLACEHOLDER = '{{package_name}}'
export const ARTIFACT_NAME = 'plugin-package'

const ALLOWED_TRIGGERS = new Set(['push', 'pull_request', 'workflow_dispatch'])

export interface RenderedWorkflow {
	path: typeof WORKFLOW_PATH
	content: string
}

/** The file name a plugin's build is packaged as, without the extension. */
export function packageNameFor(projectName: string) {
	const packageName = projectName
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
	if (!packageName) {
		throw new Error('The plugin name cannot produce a safe file name.')
	}
	return packageName
}

export function renderWorkflowTemplate(
	content: string,
	projectName: string,
): RenderedWorkflow {
	return {
		path: WORKFLOW_PATH,
		content: content.replaceAll(
			PACKAGE_NAME_PLACEHOLDER,
			packageNameFor(projectName),
		),
	}
}

interface ParsedWorkflow {
	name?: unknown
	on?: unknown
	permissions?: Record<string, unknown>
	jobs?: Record<string, { permissions?: unknown; 'runs-on'?: unknown } | null>
}

function triggersOf(on: unknown): Record<string, unknown> {
	if (typeof on === 'string') {
		return { [on]: null }
	}
	if (Array.isArray(on)) {
		return Object.fromEntries(on.map((event) => [String(event), null]))
	}
	return typeof on === 'object' && on !== null
		? (on as Record<string, unknown>)
		: {}
}

export function validateWorkflowTemplate(content: string) {
	if (content.length === 0 || content.length > 64_000) {
		throw new Error(
			'Workflow templates must contain between 1 and 64,000 characters.',
		)
	}
	if (!content.includes(PACKAGE_NAME_PLACEHOLDER)) {
		throw new Error(
			`Workflow templates must include ${PACKAGE_NAME_PLACEHOLDER}.`,
		)
	}
	let parsed: ParsedWorkflow
	try {
		parsed = parse(content) as ParsedWorkflow
	} catch {
		throw new Error('The workflow is not valid YAML.')
	}
	if (parsed?.name !== WORKFLOW_NAME || !parsed.on || !parsed.jobs) {
		throw new Error(
			`The workflow must be named "${WORKFLOW_NAME}" and have triggers and jobs.`,
		)
	}

	const triggers = triggersOf(parsed.on)
	for (const trigger of Object.keys(triggers)) {
		if (!ALLOWED_TRIGGERS.has(trigger)) {
			throw new Error(
				`Managed workflows may only run on push, pull_request, and workflow_dispatch, not ${trigger}.`,
			)
		}
	}
	if (!('push' in triggers)) {
		throw new Error('The workflow must build on push.')
	}
	const push = triggers.push
	if (
		typeof push === 'object' &&
		push !== null &&
		('tags' in push || 'tags-ignore' in push)
	) {
		throw new Error(
			'The workflow must not run on tags: BedrockNexus tags approved releases itself.',
		)
	}

	if (
		parsed.permissions?.contents !== 'read' ||
		Object.keys(parsed.permissions).some(
			(permission) => permission !== 'contents',
		)
	) {
		throw new Error(
			'The workflow must keep repository contents permission read-only.',
		)
	}
	for (const job of Object.values(parsed.jobs)) {
		const permissions = job?.permissions
		if (
			permissions !== undefined &&
			(typeof permissions !== 'object' ||
				permissions === null ||
				Object.values(permissions).some(
					(access) => access !== 'read' && access !== 'none',
				))
		) {
			throw new Error(
				'Jobs cannot request write access: the workflow only reads the repository.',
			)
		}
		const runner = job?.['runs-on']
		const selfHosted =
			typeof runner === 'string'
				? runner.toLowerCase() === 'self-hosted'
				: Array.isArray(runner) &&
					runner.some(
						(label) =>
							String(label).toLowerCase() === 'self-hosted',
					)
		if (selfHosted) {
			throw new Error(
				'Managed workflows must not execute on self-hosted runners.',
			)
		}
	}

	const normalized = content.toLowerCase()
	if (normalized.includes('${{ secrets.')) {
		throw new Error(
			'Managed workflows cannot read repository or organization secrets.',
		)
	}
	if (
		!(
			normalized.includes('actions/upload-artifact@') &&
			new RegExp(`name:\\s*["']?${ARTIFACT_NAME}["']?\\s*$`, 'm').test(
				content,
			)
		)
	) {
		throw new Error(
			`The workflow must upload the built plugin with actions/upload-artifact as "${ARTIFACT_NAME}".`,
		)
	}
	return content
}
