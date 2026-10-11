import { TableAggregate } from '@convex-dev/aggregate'

import { components } from '../../_generated/api'
import type { DataModel, Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { syncPluginOwners } from '../creatorListings'

type PublishedProjectKey = [
	Doc<'plugins'>['visibility'],
	Doc<'plugins'>['status'],
]

export const projectsBySoftware = new TableAggregate<{
	Namespace: Id<'serverSoftware'>
	Key: PublishedProjectKey
	DataModel: DataModel
	TableName: 'plugins'
}>(components.pluginsBySoftware, {
	namespace: (project) => project.softwareId,
	sortKey: (project) => [project.visibility, project.status],
})

export const projectsByOwner = new TableAggregate<{
	Namespace: string
	Key: null
	DataModel: DataModel
	TableName: 'plugins'
}>(components.pluginsByOwner, {
	namespace: (project) => projectOwnerKey(project.ownerType, project.ownerId),
	sortKey: () => null,
})

export function projectOwnerKey(
	ownerType: Doc<'plugins'>['ownerType'],
	ownerId: string,
): string {
	return `${ownerType}:${ownerId}`
}

/** Counts and the owner's search listing, after a plugin is created. */
export async function insertProjectAggregates(
	ctx: MutationCtx,
	project: Doc<'plugins'>,
): Promise<void> {
	await projectsBySoftware.insert(ctx, project)
	await projectsByOwner.insert(ctx, project)
	await syncPluginOwners(ctx, null, project)
}

/** Counts and the owners' search listings, after a plugin changes. */
export async function replaceProjectAggregates(
	ctx: MutationCtx,
	oldProject: Doc<'plugins'>,
	newProject: Doc<'plugins'>,
): Promise<void> {
	await projectsBySoftware.replace(ctx, oldProject, newProject)
	await projectsByOwner.replace(ctx, oldProject, newProject)
	await syncPluginOwners(ctx, oldProject, newProject)
}

export async function countPublishedProjectsForSoftware(
	ctx: QueryCtx,
	softwareId: Id<'serverSoftware'>,
): Promise<number> {
	return await projectsBySoftware.count(ctx, {
		namespace: softwareId,
		bounds: { prefix: ['public', 'published'] },
	})
}

export async function countPublishedProjectsForSoftwareBatch(
	ctx: QueryCtx,
	softwareIds: Array<Id<'serverSoftware'>>,
): Promise<number[]> {
	return await projectsBySoftware.countBatch(
		ctx,
		softwareIds.map((softwareId) => ({
			namespace: softwareId,
			bounds: { prefix: ['public', 'published'] },
		})),
	)
}

export async function countProjectsForOwner(
	ctx: QueryCtx,
	ownerType: Doc<'plugins'>['ownerType'],
	ownerId: string,
): Promise<number> {
	return await projectsByOwner.count(ctx, {
		namespace: projectOwnerKey(ownerType, ownerId),
	})
}
