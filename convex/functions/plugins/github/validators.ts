import { v } from 'convex/values'

export const githubAccountInputValidator = v.object({
	id: v.number(),
	login: v.string(),
	type: v.union(v.literal('User'), v.literal('Organization')),
	avatarUrl: v.optional(v.string()),
})

export const githubInstallationInputValidator = v.object({
	installationId: v.number(),
	account: githubAccountInputValidator,
	repositorySelection: v.union(v.literal('all'), v.literal('selected')),
	status: v.union(
		v.literal('active'),
		v.literal('suspended'),
		v.literal('deleted'),
	),
	suspendedAt: v.optional(v.number()),
})

export const githubRepositoryInputValidator = v.object({
	githubRepositoryId: v.number(),
	ownerLogin: v.string(),
	name: v.string(),
	fullName: v.string(),
	description: v.optional(v.string()),
	htmlUrl: v.string(),
	defaultBranch: v.string(),
	isPrivate: v.boolean(),
	isArchived: v.boolean(),
	githubUpdatedAt: v.optional(v.number()),
	pushedAt: v.optional(v.number()),
})
