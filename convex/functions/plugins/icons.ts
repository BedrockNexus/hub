import { ConvexError, v } from 'convex/values'

import { internal } from '../../_generated/api'
import { action, internalMutation, type MutationCtx } from '../../_generated/server'
import { authedMutation } from '../../lib/functions'
import { validateImageObjectMetadata } from '../../lib/media'
import { getUserByTokenIdentifier } from '../../lib/plugins/access'
import { replaceProjectAggregates } from '../../lib/plugins/aggregates'
import { enforceRateLimit } from '../../lib/rateLimits'
import {
	getCdnObjectKey,
	getCdnObjectUrl,
	r2,
	syncCdnObjectMetadata,
} from '../../lib/r2'
import { buildPluginIconR2ObjectKey, isPluginIconR2Key } from '../../lib/r2Keys'
import { requireOwnedDraft } from './publishing/model'
import type { Doc, Id } from '../../_generated/dataModel'

/**
 * Plugin icons live in the public R2 bucket under the plugin's draft:
 * generateUploadUrl, a direct PUT from the browser, then confirmUpload checks
 * the file and saves its CDN URL. Like the other details, a published plugin
 * shows a new icon once its next version is approved
 * (publishing/model:finishPublishing); until then only the draft has it.
 */

// The browser resizes icons to 256px before uploading; this is generous.
const MAX_ICON_SIZE = 1024 * 1024

export const generateUploadUrl = authedMutation({
	args: { draftId: v.id('pluginPublishingDrafts'), fileName: v.string() },
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			ctx.user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		const key = buildPluginIconR2ObjectKey({
			draftId: draft._id,
			assetId: crypto.randomUUID(),
			fileName: args.fileName,
		})
		return await r2.generateUploadUrl(key)
	},
})

export const confirmUpload = action({
	args: { draftId: v.id('pluginPublishingDrafts'), key: v.string() },
	returns: v.string(),
	handler: async (ctx, args): Promise<string> => {
		const identity = await ctx.auth.getUserIdentity()
		if (!identity) {
			throw new ConvexError({
				code: 'UNAUTHENTICATED',
				message: 'Sign in is required.',
			})
		}
		if (!isPluginIconR2Key(args.key, args.draftId)) {
			throw new ConvexError({
				code: 'INVALID_ICON',
				message: 'Upload the icon before saving it.',
			})
		}
		const url = getCdnObjectUrl(args.key)
		if (!url) {
			throw new Error('R2_CDN_PUBLIC_URL is not configured')
		}
		await syncCdnObjectMetadata(ctx, args.key)
		await validateImageObjectMetadata(ctx, args.key, MAX_ICON_SIZE)
		await ctx.runMutation(internal.functions.plugins.icons.setIcon, {
			tokenIdentifier: identity.tokenIdentifier,
			draftId: args.draftId,
			iconUrl: url,
		})
		return url
	},
})

export const remove = authedMutation({
	args: { draftId: v.id('pluginPublishingDrafts') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const draft = await requireOwnedDraft(ctx, args.draftId, ctx.user)
		await replaceIcon(ctx, draft, undefined)
		return null
	},
})

export const setIcon = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		draftId: v.id('pluginPublishingDrafts'),
		iconUrl: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const draft = await requireOwnedDraft(ctx, args.draftId, user)
		await replaceIcon(ctx, draft, args.iconUrl)
		return null
	},
})

/**
 * Sets the draft's icon, and the plugin's too while it is unpublished. Deletes
 * the replaced upload unless the published plugin still shows it.
 */
async function replaceIcon(
	ctx: MutationCtx,
	draft: Doc<'pluginPublishingDrafts'>,
	iconUrl: string | undefined,
) {
	const project = draft.projectId
		? await ctx.db.get('plugins', draft.projectId)
		: null
	const now = Date.now()
	await ctx.db.patch('pluginPublishingDrafts', draft._id, {
		iconUrl,
		updatedAt: now,
	})
	if (project && project.status !== 'published') {
		await ctx.db.patch('plugins', project._id, { iconUrl, updatedAt: now })
		const updated = await ctx.db.get('plugins', project._id)
		if (updated) {
			await replaceProjectAggregates(ctx, project, updated)
		}
	}
	const stillShown =
		project?.status === 'published' && project.iconUrl === draft.iconUrl
	if (draft.iconUrl && draft.iconUrl !== iconUrl && !stillShown) {
		await deleteIcon(ctx, draft._id, draft.iconUrl)
	}
}

/** Deletes an icon upload of this draft; other URLs are left alone. */
export async function deleteIcon(
	ctx: MutationCtx,
	draftId: Id<'pluginPublishingDrafts'>,
	iconUrl: string,
) {
	const key = getCdnObjectKey(iconUrl)
	if (key && isPluginIconR2Key(key, draftId)) {
		await r2.deleteObject(ctx, key)
	}
}
