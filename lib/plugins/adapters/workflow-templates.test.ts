import { describe, expect, it } from 'vitest'

import { TEST_WORKFLOW_TEMPLATE } from './fixtures'
import {
	renderWorkflowTemplate,
	validateWorkflowTemplate,
} from './workflow-templates'

describe('managed workflow templates', () => {
	it('renders a valid template with the project package name', () => {
		expect(() =>
			validateWorkflowTemplate(TEST_WORKFLOW_TEMPLATE),
		).not.toThrow()

		const workflow = renderWorkflowTemplate(
			TEST_WORKFLOW_TEMPLATE,
			'Nexus Essentials',
		)
		expect(workflow.path).toBe('.github/workflows/bedrocknexus-publish.yml')
		expect(workflow.content).toContain('dist/Nexus-Essentials')
		expect(workflow.content).not.toContain('{{package_name}}')
	})

	it('rejects templates that remove the managed package placeholder', () => {
		const template = TEST_WORKFLOW_TEMPLATE.replaceAll(
			'{{package_name}}',
			'fixed-name',
		)
		expect(() => validateWorkflowTemplate(template)).toThrow(
			'must include {{package_name}}',
		)
	})

	it('rejects templates that broaden global repository permissions', () => {
		const template = TEST_WORKFLOW_TEMPLATE.replace(
			'permissions:\n  contents: read',
			'permissions:\n  contents: write',
		)
		expect(() => validateWorkflowTemplate(template)).toThrow('read-only')
	})

	it('rejects privileged events, secrets, and self-hosted runners', () => {
		const template = TEST_WORKFLOW_TEMPLATE
		expect(() =>
			validateWorkflowTemplate(
				template.replace('  pull_request:', '  pull_request_target:'),
			),
		).toThrow('pull_request_target')
		expect(() =>
			validateWorkflowTemplate(
				`${template}\n# \${{ secrets.DEPLOY_TOKEN }}\n`,
			),
		).toThrow('cannot read')
		expect(() =>
			validateWorkflowTemplate(
				template.replace(
					'runs-on: ubuntu-latest',
					'runs-on: self-hosted',
				),
			),
		).toThrow('self-hosted')
	})
})
