import { ShardedCounter } from '@convex-dev/sharded-counter'

import { components } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { projectOwnerKey } from './aggregates'

export const projectDownloadCounts = new ShardedCounter<Id<'plugins'>>(
	components.pluginDownloadCounts,
	{
		defaultShards: 16,
	},
)

export const ownerDownloadCounts = new ShardedCounter<string>(
	components.pluginOwnerDownloadCounts,
	{
		defaultShards: 16,
	},
)

export async function getProjectDownloadCount(
	ctx: QueryCtx,
	project: Doc<'plugins'>,
): Promise<number> {
	if (!project.downloadCounterReadyAt) {
		return project.downloadCount
	}

	return Math.round(await projectDownloadCounts.count(ctx, project._id))
}

export async function getOwnerDownloadCount(
	ctx: QueryCtx,
	ownerType: Doc<'plugins'>['ownerType'],
	ownerId: string,
): Promise<number> {
	return Math.round(
		await ownerDownloadCounts.count(
			ctx,
			projectOwnerKey(ownerType, ownerId),
		),
	)
}
