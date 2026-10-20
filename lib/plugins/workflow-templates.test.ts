import { describe, expect, it } from 'vitest'
import {
	renderWorkflowTemplate,
	validateWorkflowTemplate,
} from './workflow-templates'
import { TEST_WORKFLOW_TEMPLATE } from './workflow-templates.fixtures'

describe('managed workflow templates', () => {
	it('renders a valid template with the plugin name', () => {
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

	it('rejects templates that remove the package placeholder', () => {
		const template = TEST_WORKFLOW_TEMPLATE.replaceAll(
			'{{package_name}}',
			'fixed-name',
		)
		expect(() => validateWorkflowTemplate(template)).toThrow(
			'must include {{package_name}}',
		)
	})

	it('rejects any write permission', () => {
		expect(() =>
			validateWorkflowTemplate(
				TEST_WORKFLOW_TEMPLATE.replace(
					'permissions:\n  contents: read',
					'permissions:\n  contents: write',
				),
			),
		).toThrow('read-only')
		expect(() =>
			validateWorkflowTemplate(
				TEST_WORKFLOW_TEMPLATE.replace(
					'    runs-on: ubuntu-latest',
					'    runs-on: ubuntu-latest\n    permissions:\n      contents: write',
				),
			),
		).toThrow('write access')
	})

	it('rejects tag builds, privileged events, secrets, and self-hosted runners', () => {
		expect(() =>
			validateWorkflowTemplate(
				TEST_WORKFLOW_TEMPLATE.replace(
					'    branches:\n      - "**"',
					'    tags:\n      - "v*"',
				),
			),
		).toThrow('must not run on tags')
		expect(() =>
			validateWorkflowTemplate(
				TEST_WORKFLOW_TEMPLATE.replace(
					'  pull_request:',
					'  pull_request_target:',
				),
			),
		).toThrow('pull_request_target')
		expect(() =>
			validateWorkflowTemplate(
				`${TEST_WORKFLOW_TEMPLATE}\n# \${{ secrets.DEPLOY_TOKEN }}\n`,
			),
		).toThrow('cannot read')
		expect(() =>
			validateWorkflowTemplate(
				TEST_WORKFLOW_TEMPLATE.replace(
					'runs-on: ubuntu-latest',
					'runs-on: self-hosted',
				),
			),
		).toThrow('self-hosted')
	})

	it('requires the plugin-package artifact', () => {
		expect(() =>
			validateWorkflowTemplate(
				TEST_WORKFLOW_TEMPLATE.replace(
					'name: plugin-package',
					'name: something-else',
				),
			),
		).toThrow('plugin-package')
	})
})
