import { components } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isPublicProject, isPublicServer } from './contentVisibility'

/**
 * Keeps `creatorListings` - the rows that make creators and organizations
 * findable by name - in step with what their public pages show.
 *
 * A row exists only while its owner has something public, a public address
 * (username or organization slug) and, for users, no ban. Every write that can
 * change that must come through here:
 *
 * - any server or project write  -> syncServerOwners / syncProjectOwners
 *   (called from lib/activity.ts afterServerWrite / afterProjectWrite)
 * - any plugin write             -> syncPluginOwners
 *   (called from lib/plugins/aggregates.ts and plugins/deletion.ts)
 * - a display name change        -> syncCreatorListing (site/users.ts)
 * - a rename, ban, deletion or new picture -> the Better Auth triggers in
 *   auth.ts, and site/users.ts updateAdminUser, which writes around them
 *
 * Owners whose content existed first get their rows from
 * functions/site/migrations:backfillCreatorListings.
 *
 * A listing carries its owner's avatar or logo as a CDN URL
 * (lib/ownerPictures.ts). Pictures still saved inline as data URLs, tens of
 * kilobytes each, are left out until
 * functions/site/migrations:backfillInlinePictures has moved them.
 */

export type CreatorOwnerType = Doc<'creatorListings'>['ownerType']

/** The Better Auth user fields a listing is built from. */
export interface ListedUser {
	_id: string
	username?: string | null
	displayUsername?: string | null
	image?: string | null
	banned?: boolean | null
}

/** The Better Auth organization fields a listing is built from. */
export interface ListedOrganization {
	_id: string
	name: string
	slug: string
	logo?: string | null
}

type ListingIdentity = Pick<
	Doc<'creatorListings'>,
	'slug' | 'name' | 'searchText' | 'pictureUrl'
>
type ListingFields = Omit<
	Doc<'creatorListings'>,
	'_id' | '_creationTime' | 'ownerType' | 'ownerId' | 'updatedAt'
>
type ContentId = Id<'servers'> | Id<'projects'> | Id<'plugins'>

// Counts stop here; no creator is expected to come close.
const COUNT_LIMIT = 500
const LISTING_FIELDS = [
	'slug',
	'name',
	'searchText',
	'pictureUrl',
	'serverCount',
	'projectCount',
	'pluginCount',
] as const satisfies ReadonlyArray<keyof ListingFields>

function isPublicPlugin(plugin: Doc<'plugins'>) {
	return plugin.visibility === 'public' && plugin.status === 'published'
}

function buildSearchText(parts: ReadonlyArray<string | null | undefined>) {
	return [...new Set(parts.filter((part): part is string => Boolean(part)))]
		.join(' ')
		.slice(0, 300)
}

// Only URLs are copied; a picture still saved inline never is.
function listingPicture(picture: string | null | undefined) {
	return picture && /^https?:\/\//.test(picture) ? picture : undefined
}

/** Null when the user has no public page: no username, or banned. */
async function userIdentity(
	ctx: MutationCtx,
	user: ListedUser,
): Promise<ListingIdentity | null> {
	if (!user.username || user.banned) {
		return null
	}
	const profile = await ctx.db
		.query('userProfiles')
		.withIndex('by_user', (q) => q.eq('userId', user._id))
		.first()
	const name = profile?.displayName ?? user.displayUsername ?? user.username
	return {
		slug: user.username,
		name,
		searchText: buildSearchText([
			name,
			user.displayUsername,
			user.username,
		]),
		pictureUrl: listingPicture(user.image),
	}
}

function organizationIdentity(organization: ListedOrganization): ListingIdentity {
	return {
		slug: organization.slug,
		name: organization.name,
		searchText: buildSearchText([organization.name, organization.slug]),
		pictureUrl: listingPicture(organization.logo),
	}
}

/**
 * What the owner's public page shows: a user's page lists the servers they
 * registered, an organization's the servers it owns.
 */
async function countPublicContent(
	ctx: MutationCtx,
	ownerType: CreatorOwnerType,
	ownerId: string,
	excluding?: ContentId,
) {
	const [servers, projects, plugins] = await Promise.all([
		ownerType === 'user'
			? ctx.db
					.query('servers')
					.withIndex('by_registered_by', (q) =>
						q.eq('registeredBy', ownerId),
					)
					.take(COUNT_LIMIT)
			: ctx.db
					.query('servers')
					.withIndex('by_owner', (q) =>
						q.eq('ownerType', ownerType).eq('ownerId', ownerId),
					)
					.take(COUNT_LIMIT),
		ctx.db
			.query('projects')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', ownerType).eq('ownerId', ownerId),
			)
			.take(COUNT_LIMIT),
		ctx.db
			.query('plugins')
			.withIndex(
				'by_owner_type_and_owner_id_and_visibility_and_status',
				(q) =>
					q
						.eq('ownerType', ownerType)
						.eq('ownerId', ownerId)
						.eq('visibility', 'public')
						.eq('status', 'published'),
			)
			.take(COUNT_LIMIT),
	])
	return {
		serverCount: servers.filter(
			(server) => server._id !== excluding && isPublicServer(server),
		).length,
		projectCount: projects.filter(
			(project) => project._id !== excluding && isPublicProject(project),
		).length,
		pluginCount: plugins.filter((plugin) => plugin._id !== excluding)
			.length,
	}
}

async function writeListing(
	ctx: MutationCtx,
	ownerType: CreatorOwnerType,
	ownerId: string,
	next: ListingFields | null,
) {
	const existing = await ctx.db
		.query('creatorListings')
		.withIndex('by_ownerType_and_ownerId', (q) =>
			q.eq('ownerType', ownerType).eq('ownerId', ownerId),
		)
		.unique()
	if (!next) {
		if (existing) {
			await ctx.db.delete('creatorListings', existing._id)
		}
		return
	}
	if (!existing) {
		await ctx.db.insert('creatorListings', {
			ownerType,
			ownerId,
			...next,
			updatedAt: Date.now(),
		})
		return
	}
	// Unchanged rows are left alone so they never invalidate search results.
	if (LISTING_FIELDS.some((field) => existing[field] !== next[field])) {
		await ctx.db.patch('creatorListings', existing._id, {
			...next,
			updatedAt: Date.now(),
		})
	}
}

async function syncListing(
	ctx: MutationCtx,
	ownerType: CreatorOwnerType,
	ownerId: string,
	identity: ListingIdentity | null,
	excluding?: ContentId,
) {
	if (!identity) {
		await writeListing(ctx, ownerType, ownerId, null)
		return
	}
	const counts = await countPublicContent(ctx, ownerType, ownerId, excluding)
	const hasContent =
		counts.serverCount + counts.projectCount + counts.pluginCount > 0
	await writeListing(
		ctx,
		ownerType,
		ownerId,
		hasContent ? { ...identity, ...counts } : null,
	)
}

/** Rebuilds a user's listing from the account document already in hand. */
export async function syncUserListing(
	ctx: MutationCtx,
	user: ListedUser,
	excluding?: ContentId,
) {
	await syncListing(
		ctx,
		'user',
		user._id,
		await userIdentity(ctx, user),
		excluding,
	)
}

/** Rebuilds an organization's listing from the document already in hand. */
export async function syncOrganizationListing(
	ctx: MutationCtx,
	organization: ListedOrganization,
	excluding?: ContentId,
) {
	await syncListing(
		ctx,
		'organization',
		organization._id,
		organizationIdentity(organization),
		excluding,
	)
}

/**
 * Rebuilds one owner's listing, removing it when the account is gone.
 * `excluding` names a document that is about to be deleted.
 */
export async function syncCreatorListing(
	ctx: MutationCtx,
	ownerType: CreatorOwnerType,
	ownerId: string,
	excluding?: ContentId,
) {
	const owner = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: ownerType,
		where: [{ field: '_id', value: ownerId }],
	})) as ListedUser | ListedOrganization | null
	if (!owner) {
		await writeListing(ctx, ownerType, ownerId, null)
	} else if (ownerType === 'user') {
		await syncUserListing(ctx, owner as ListedUser, excluding)
	} else {
		await syncOrganizationListing(
			ctx,
			owner as ListedOrganization,
			excluding,
		)
	}
}

/** Removes the listing of an account that no longer exists. */
export async function removeCreatorListing(
	ctx: MutationCtx,
	ownerType: CreatorOwnerType,
	ownerId: string,
) {
	await writeListing(ctx, ownerType, ownerId, null)
}

interface ContentChange<T> {
	before: T | null
	after: T | null
	isPublic: (doc: T) => boolean
	/** `type:id` keys of every owner whose page shows the document. */
	owners: (doc: T) => string[]
}

/**
 * Re-counts the owners a content write can affect. Edits that change neither
 * who the owners are nor whether the document is public are skipped.
 */
async function syncContentOwners<T extends { _id: ContentId }>(
	ctx: MutationCtx,
	{ before, after, isPublic, owners }: ContentChange<T>,
) {
	const beforeOwners = before ? owners(before) : []
	const afterOwners = after ? owners(after) : []
	if (
		before &&
		after &&
		isPublic(before) === isPublic(after) &&
		beforeOwners.join() === afterOwners.join()
	) {
		return
	}
	const excluding = before && !after ? before._id : undefined
	for (const key of new Set([...beforeOwners, ...afterOwners])) {
		const separator = key.indexOf(':')
		await syncCreatorListing(
			ctx,
			key.slice(0, separator) as CreatorOwnerType,
			key.slice(separator + 1),
			excluding,
		)
	}
}

/** Call with the server as it was and as it is; `after` null means deleted. */
export async function syncServerOwners(
	ctx: MutationCtx,
	before: Doc<'servers'> | null,
	after: Doc<'servers'> | null,
) {
	await syncContentOwners(ctx, {
		before,
		after,
		isPublic: isPublicServer,
		owners: (server) => [
			`user:${server.registeredBy}`,
			...(server.ownerType === 'organization'
				? [`organization:${server.ownerId}`]
				: []),
		],
	})
}

/** Call with the project as it was and as it is; `after` null means deleted. */
export async function syncProjectOwners(
	ctx: MutationCtx,
	before: Doc<'projects'> | null,
	after: Doc<'projects'> | null,
) {
	await syncContentOwners(ctx, {
		before,
		after,
		isPublic: isPublicProject,
		owners: (project) => [`${project.ownerType}:${project.ownerId}`],
	})
}

/** Call with the plugin as it was and as it is; `after` null means deleted. */
export async function syncPluginOwners(
	ctx: MutationCtx,
	before: Doc<'plugins'> | null,
	after: Doc<'plugins'> | null,
) {
	await syncContentOwners(ctx, {
		before,
		after,
		isPublic: isPublicPlugin,
		owners: (plugin) => [`${plugin.ownerType}:${plugin.ownerId}`],
	})
}
