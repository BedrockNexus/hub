// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEST_WORKFLOW_TEMPLATE } from '../../../lib/plugins/workflow-templates.fixtures'
import { parseWorkflowCatalog } from '../../../lib/plugins/workflow-catalog'
import { fetchRepositoryCatalog } from './workflowCatalog'

const commit = 'a'.repeat(40)
const entry = {
	key: 'pmmp:default',
	softwareSlug: 'pocketmine-mp',
	label: 'PMMP',
	path: 'templates/pmmp.yml',
}
afterEach(() => vi.unstubAllGlobals())

describe('official repository fetching', () => {
	it('fetches the index and every template from the same full commit', async () => {
		const urls: string[] = []
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				urls.push(url)
				if (url.endsWith('/git/ref/heads/main'))
					return Response.json({ object: { sha: commit } })
				if (url.endsWith('/templates/index.json'))
					return Response.json({
						schemaVersion: 1,
						templates: [entry],
					})
				return new Response(TEST_WORKFLOW_TEMPLATE)
			}),
		)
		expect(await fetchRepositoryCatalog()).toEqual({
			commit,
			templates: [{ ...entry, content: TEST_WORKFLOW_TEMPLATE }],
		})
		expect(urls.slice(1).every((url) => url.includes(`/${commit}/`))).toBe(
			true,
		)
	})
	it('refuses invalid metadata, duplicate keys and paths outside templates', () => {
		for (const item of [
			{ ...entry, path: '../outside.yml' },
			{ ...entry, path: 'https://example.com/build.yml' },
			{ ...entry, label: '' },
		]) {
			expect(() =>
				parseWorkflowCatalog({ schemaVersion: 1, templates: [item] }),
			).toThrow()
		}
		expect(() =>
			parseWorkflowCatalog({
				schemaVersion: 1,
				templates: [entry, entry],
			}),
		).toThrow('Duplicate')
		expect(() =>
			parseWorkflowCatalog({ schemaVersion: 2, templates: [] }),
		).toThrow()
	})

	it('rejects failed, oversized or invalid remote content', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('down', { status: 503 })),
		)
		await expect(fetchRepositoryCatalog()).rejects.toThrow('HTTP 503')
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.endsWith('/git/ref/heads/main'))
					return Response.json({ object: { sha: commit } })
				if (url.endsWith('/templates/index.json'))
					return Response.json({
						schemaVersion: 1,
						templates: [entry],
					})
				return new Response('x'.repeat(64_001))
			}),
		)
		await expect(fetchRepositoryCatalog()).rejects.toThrow('size limit')
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.endsWith('/git/ref/heads/main'))
					return Response.json({ object: { sha: commit } })
				if (url.endsWith('/templates/index.json'))
					return Response.json({
						schemaVersion: 1,
						templates: [entry],
					})
				return new Response('name: Invalid build')
			}),
		)
		await expect(fetchRepositoryCatalog()).rejects.toThrow('{{package_name}}')
	})
})
