import type { Doc } from '../_generated/dataModel'
import { isPublicProject } from './contentVisibility'

export function isStandaloneReleaseReview(
	project: Doc<'projects'>,
	release: Doc<'projectVersions'>,
) {
	return (
		isPublicProject(project) &&
		project.submissionStatus !== 'pending' &&
		release.reviewStatus === 'pending' &&
		!release.deletionRequestedAt
	)
}
