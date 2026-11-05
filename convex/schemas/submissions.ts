import { v } from 'convex/values'

export const submissionStatus = v.union(
	v.literal('pending'),
	v.literal('changes_requested'),
	v.literal('approved'),
	v.literal('rejected'),
)

// Private, server-generated snapshots. Never accepted as client mutation args.
export const submissionFields = {
	submissionStatus: v.optional(submissionStatus),
	submissionRevision: v.optional(v.number()),
	submissionReason: v.optional(v.string()),
	submittedAt: v.optional(v.number()),
	draftChangesJson: v.optional(v.string()),
	publishedGalleryJson: v.optional(v.string()),
}
