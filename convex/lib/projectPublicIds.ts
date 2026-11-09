import type { StoredProjectType } from '../../lib/project-artifacts'
import { projectReference } from '../../lib/content-reference'
import type { MutationCtx } from '../_generated/server'

/** Stored once; the index read also protects against concurrent collisions. */
export async function allocateProjectPublicId(ctx: Pick<MutationCtx, 'db'>, type: StoredProjectType) {
	for (let attempt = 0; attempt < 20; attempt++) {
		const code = Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
		const candidate = projectReference(type, code)
		const existing = await ctx.db.query('projects').withIndex('by_publicId', q => q.eq('publicId', candidate)).unique()
		if (!existing) return candidate
	}
	throw new Error('Could not allocate a unique project URL. Please try again.')
}
