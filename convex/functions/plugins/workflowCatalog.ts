'use node'

import { ConvexError, v } from 'convex/values'
import {
	parseWorkflowCatalog,
	WORKFLOW_REPOSITORY,
} from '../../../lib/plugins/workflow-catalog'
import { validateWorkflowTemplate } from '../../../lib/plugins/workflow-templates'
import { internal } from '../../_generated/api'
import { action, internalAction, type ActionCtx } from '../../_generated/server'

async function fetchBytes(url: string, maxBytes: number) {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(15_000),
		headers: { 'User-Agent': 'BedrockNexus-workflow-catalog' },
		redirect: 'error',
	})
	if (!response.ok)
		throw new Error(
			`Workflow repository returned HTTP ${response.status} from ${new URL(url).hostname}.`,
		)
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
	return Buffer.concat(chunks)
}

async function fetchText(url: string, maxBytes: number) {
	return (await fetchBytes(url, maxBytes)).toString('utf8')
}

/** Git smart HTTP v0 reference discovery; no shared GitHub REST API quota. */
export function parseGitMainCommit(advertisement: Uint8Array): string {
	const bytes = Buffer.from(advertisement)
	let offset = 0
	let service = false
	let flushed = false
	let commit: string | undefined
	while (offset < bytes.length) {
		const prefix = bytes.subarray(offset, offset + 4).toString('ascii')
		if (!/^[0-9a-fA-F]{4}$/.test(prefix))
			throw new Error('Invalid Git reference packet length.')
		const length = Number.parseInt(prefix, 16)
		offset += 4
		flushed = length === 0
		if (flushed) continue
		if (length < 4 || offset + length - 4 > bytes.length)
			throw new Error('Truncated Git reference packet.')
		const line = bytes
			.subarray(offset, offset + length - 4)
			.toString('utf8')
		offset += length - 4
		if (!service) {
			if (line !== '# service=git-upload-pack\n')
				throw new Error('Unexpected Git reference service.')
			service = true
			continue
		}
		const match = /^([a-f0-9]{40}) refs\/heads\/main\n?$/.exec(
			line.split('\0')[0],
		)
		if (match) {
			if (commit)
				throw new Error(
					'Duplicate main branch in Git reference advertisement.',
				)
			commit = match[1]
		}
	}
	if (!service || !flushed || !commit)
		throw new Error(
			'Workflow repository did not advertise a complete main branch reference.',
		)
	return commit
}

export async function fetchRepositoryCatalog() {
	const commit = parseGitMainCommit(
		await fetchBytes(
			`https://github.com/${WORKFLOW_REPOSITORY}.git/info/refs?service=git-upload-pack`,
			65_536,
		),
	)
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
