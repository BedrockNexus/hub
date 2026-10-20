import { parse } from 'yaml'

import type { GeneratedWorkflow } from './types'
import { assertValidGeneratedWorkflow, WORKFLOW_PATH } from './workflow'

/**
 * Publishing workflows are written and versioned by admins in the workflow
 * editor (/admin/plugins/workflows) and stored in `pluginWorkflowTemplates`.
 * None ship with the code; this module only renders and checks them.
 */

export const PACKAGE_NAME_PLACEHOLDER = '{{package_name}}'

export function renderWorkflowTemplate(
	content: string,
	projectName: string,
): GeneratedWorkflow {
	const packageName = projectName
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
	if (!packageName) {
		throw new Error(
			'The project name cannot produce a safe release asset name.',
		)
	}
	const rendered = content.replaceAll(PACKAGE_NAME_PLACEHOLDER, packageName)
	return assertValidGeneratedWorkflow({
		path: WORKFLOW_PATH,
		content: rendered,
		buildCommand: 'managed-template',
		releaseAssetPattern: `dist/${packageName}`,
	})
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
	const parsed = parse(content) as {
		on?: Record<string, unknown>
		permissions?: Record<string, unknown>
		jobs?: Record<
			string,
			{ permissions?: Record<string, unknown>; 'runs-on'?: unknown }
		>
	}
	if (
		parsed.permissions?.contents !== 'read' ||
		Object.keys(parsed.permissions).some(
			(permission) => permission !== 'contents',
		)
	) {
		throw new Error(
			'The workflow must keep global repository contents permission read-only.',
		)
	}
	if (parsed.jobs?.release?.permissions?.contents !== 'write') {
		throw new Error(
			'Only the release job may request repository contents write access.',
		)
	}
	for (const [jobName, job] of Object.entries(parsed.jobs ?? {})) {
		for (const [permission, access] of Object.entries(
			job.permissions ?? {},
		)) {
			if (
				access === 'write' &&
				(jobName !== 'release' || permission !== 'contents')
			) {
				throw new Error(
					'Only the release job may request repository contents write access.',
				)
			}
		}
	}
	const normalized = content.toLowerCase()
	if ('pull_request_target' in (parsed.on ?? {})) {
		throw new Error(
			'Managed workflows cannot use the privileged pull_request_target event.',
		)
	}
	if (normalized.includes('${{ secrets.')) {
		throw new Error(
			'Managed workflows cannot read repository or organization secrets.',
		)
	}
	if (
		Object.values(parsed.jobs ?? {}).some((job) => {
			const runner = job['runs-on']
			return typeof runner === 'string'
				? runner.toLowerCase() === 'self-hosted'
				: Array.isArray(runner) &&
						runner.some(
							(label) =>
								String(label).toLowerCase() === 'self-hosted',
						)
		})
	) {
		throw new Error(
			'Managed workflows must not execute on self-hosted runners.',
		)
	}
	renderWorkflowTemplate(content, 'TemplateValidation')
	return content
}
