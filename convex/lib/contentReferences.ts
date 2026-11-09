import { parseProjectReference } from '../../lib/content-reference'
import { normalizeProjectType } from '../../lib/project-artifacts'
import { parsePluginDashboardId } from '../../lib/plugins/plugin-dashboard-id'
import { parseServerReference } from '../../lib/server-routes'
import type { QueryCtx } from '../_generated/server'

export async function resolveProjectReference(ctx: Pick<QueryCtx, 'db'>, reference: string) {
	const parsed = parseProjectReference(reference)
	if (parsed) {
		const short = await ctx.db.query('projects').withIndex('by_publicId', q => q.eq('publicId', reference)).unique()
		if (short) return normalizeProjectType(short.type) === parsed.type ? short : null
		const id = ctx.db.normalizeId('projects', parsed.id)
		const project = id ? await ctx.db.get('projects', id) : null
		return project && normalizeProjectType(project.type) === parsed.type ? project : null
	}
	const id = ctx.db.normalizeId('projects', reference)
	if (id) return await ctx.db.get('projects', id)
	return await ctx.db.query('projects').withIndex('by_slug', q => q.eq('slug', reference)).unique()
}

export async function resolvePluginReference(ctx: Pick<QueryCtx, 'db'>, reference: string) {
	const repositoryId = parsePluginDashboardId(reference)
	if (repositoryId !== null) {
		const repository = await ctx.db.query('githubRepositories').withIndex('by_github_repository_id', q => q.eq('githubRepositoryId', repositoryId)).unique()
		return repository ? await ctx.db.query('plugins').withIndex('by_repository_id', q => q.eq('repositoryId', repository._id)).unique() : null
	}
	return await ctx.db.query('plugins').withIndex('by_slug', q => q.eq('slug', reference)).unique()
}

export async function resolveServerReference(ctx: Pick<QueryCtx, 'db'>, reference: string) {
	const id = ctx.db.normalizeId('servers', reference)
	if (id) return await ctx.db.get('servers', id)
	const address = parseServerReference(reference)
	if (address) {
		const server = await ctx.db.query('servers').withIndex('by_address_key', q => q.eq('addressKey', address.key)).unique()
		if (server) return server
		const legacy = await ctx.db.query('servers').withIndex('by_ipAddress_and_port', q => q.eq('ipAddress', address.host).eq('port', address.port)).unique()
		if (legacy) return legacy
	}
	return await ctx.db.query('servers').withIndex('by_slug', q => q.eq('slug', reference)).unique()
}
