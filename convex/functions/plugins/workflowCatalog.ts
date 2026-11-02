'use node'

import { ConvexError, v } from 'convex/values'
import {
	parseWorkflowCatalog,
	WORKFLOW_REPOSITORY,
} from '../../../lib/plugins/workflow-catalog'
import { validateWorkflowTemplate } from '../../../lib/plugins/workflow-templates'
import { internal } from '../../_generated/api'
import { action, internalAction, type ActionCtx } from '../../_generated/server'

async function fetchText(url: string, maxBytes: number) {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(15_000),
		headers: { 'User-Agent': 'BedrockNexus-workflow-catalog' },
		redirect: 'error',
	})
	if (!response.ok)
		throw new Error(`Workflow repository returned HTTP ${response.status}.`)
	if (!response.body)
		throw new Error('Workflow repository returned an empty response.')
	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let length = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			length += value.byteLength
			if (length > maxBytes)
				throw new Error(
					'Workflow repository response exceeds the size limit.',
				)
			chunks.push(value)
		}
	} finally {
		await reader.cancel()
	}
	return Buffer.concat(chunks).toString('utf8')
}

export async function fetchRepositoryCatalog() {
	const ref: unknown = JSON.parse(
		await fetchText(
			`https://api.github.com/repos/${WORKFLOW_REPOSITORY}/git/ref/heads/main`,
			16_384,
		),
	)
	const commit = (ref as { object?: { sha?: unknown } })?.object?.sha
	if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit))
		throw new Error('Workflow repository returned an invalid commit.')
	const base = `https://raw.githubusercontent.com/${WORKFLOW_REPOSITORY}/${commit}/`
	const entries = parseWorkflowCatalog(
		JSON.parse(await fetchText(`${base}templates/index.json`, 32_768)),
	)
	const templates = await Promise.all(
		entries.map(async (entry) => {
			const content = await fetchText(base + entry.path, 64_000)
			validateWorkflowTemplate(content)
			return { ...entry, content }
		}),
	)
	return { commit, templates }
}

async function synchronize(
	ctx: ActionCtx,
): Promise<{ updated: number; retired: number; commit: string } | null> {
	const generation: number | null = await ctx.runMutation(
		internal.functions.plugins.workflowTemplates.beginRefresh,
		{},
	)
	if (generation === null) return null
	try {
		const catalog = await fetchRepositoryCatalog()
		return await ctx.runMutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation, ...catalog },
		)
	} catch (error) {
		const message =
			error instanceof Error
				? error.message.slice(0, 300)
				: 'Workflow repository refresh failed.'
		await ctx.runMutation(
			internal.functions.plugins.workflowTemplates.recordRefreshError,
			{ generation, message },
		)
		throw new ConvexError({
			code: 'WORKFLOW_CATALOG_UNAVAILABLE',
			message: `${message} The last successful catalog is still available.`,
		})
	}
}

const refreshResult = v.union(
	v.null(),
	v.object({ updated: v.number(), retired: v.number(), commit: v.string() }),
)

export const refresh = action({
	args: {},
	returns: refreshResult,
	handler: async (ctx) => {
		await ctx.runQuery(
			internal.functions.plugins.workflowTemplates.authorizeRefresh,
			{},
		)
		return await synchronize(ctx)
	},
})

export const refreshScheduled = internalAction({
	args: {},
	returns: refreshResult,
	handler: async (ctx) => await synchronize(ctx),
})
