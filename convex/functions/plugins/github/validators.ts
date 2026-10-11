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

export const repositorySnapshotValidator = v.object({
	repositoryId: v.id('githubRepositories'),
	fullName: v.string(),
	defaultBranch: v.string(),
	description: v.optional(v.string()),
	license: v.optional(v.string()),
	topics: v.array(v.string()),
	rateLimitRemaining: v.optional(v.number()),
	tree: v.object({
		sha: v.string(),
		truncated: v.boolean(),
		entries: v.array(
			v.object({
				path: v.string(),
				type: v.union(
					v.literal('blob'),
					v.literal('tree'),
					v.literal('commit'),
				),
				sha: v.string(),
				size: v.optional(v.number()),
			}),
		),
	}),
})
