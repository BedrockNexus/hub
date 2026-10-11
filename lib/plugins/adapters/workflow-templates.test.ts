import { describe, expect, it } from 'vitest'

import {
	getDefaultWorkflowTemplate,
	renderWorkflowTemplate,
	validateWorkflowTemplate,
	WORKFLOW_TEMPLATE_KEYS,
} from './workflow-templates'

describe('managed workflow templates', () => {
	it.each(WORKFLOW_TEMPLATE_KEYS)('renders a valid %s default', (key) => {
		const template = getDefaultWorkflowTemplate(key)
		expect(() => validateWorkflowTemplate(template)).not.toThrow()

		const workflow = renderWorkflowTemplate(template, 'Nexus Essentials')
		expect(workflow.path).toBe('.github/workflows/bedrocknexus-publish.yml')
		expect(workflow.content).toContain('dist/Nexus-Essentials')
		expect(workflow.content).not.toContain('{{package_name}}')
	})

	it('rejects templates that remove the managed package placeholder', () => {
		const template = getDefaultWorkflowTemplate(
			'pocketmine-mp:composer',
		).replaceAll('{{package_name}}', 'fixed-name')
		expect(() => validateWorkflowTemplate(template)).toThrow(
			'must include {{package_name}}',
		)
	})

	it('rejects templates that broaden global repository permissions', () => {
		const template = getDefaultWorkflowTemplate(
			'powernukkitx:gradle',
		).replace(
			'permissions:\n  contents: read',
			'permissions:\n  contents: write',
		)
		expect(() => validateWorkflowTemplate(template)).toThrow('read-only')
	})

	it('rejects privileged events, secrets, and self-hosted runners', () => {
		const template = getDefaultWorkflowTemplate('pocketmine-mp:composer')
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
