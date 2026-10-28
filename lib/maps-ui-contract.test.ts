import { expect, test } from 'bun:test'
import { contentDashboard, contentHref } from './content-routes'
import {
	MAP_RELEASE_DEFAULTS,
	mapReleaseMetadataSchema,
} from './map-release-metadata'
import { projectSubmissionChecklist } from './project-submission'
import {
	createVersionFormSchema,
	PROJECT_FORM_DEFAULTS,
	projectMetadataFromForm,
} from './schemas/projects'

const release = {
	version: '1.0.0',
	uploadId: 'reserved-upload',
	fileName: 'world.mcworld',
	fileSize: 10,
	gameVersions: ['1.21.0'],
}
test('requires map release fields while leaving pack release requirements unchanged', () => {
	expect(createVersionFormSchema('addon').safeParse(release).success).toBe(
		true,
	)
	expect(createVersionFormSchema('map').safeParse(release).success).toBe(
		false,
	)
	expect(
		createVersionFormSchema('map').safeParse({
			...release,
			releaseMetadata: {
				...MAP_RELEASE_DEFAULTS,
				gameplay:
					'Complete the parkour course from the starting platform.',
			},
		}).success,
	).toBe(true)
	expect(
		mapReleaseMetadataSchema.safeParse(MAP_RELEASE_DEFAULTS).success,
	).toBe(false)
})
test('keeps map requirements out of mutable listing metadata', () => {
	expect(
		projectMetadataFromForm({ ...PROJECT_FORM_DEFAULTS, type: 'map' }),
	).toBeUndefined()
	expect(contentHref('map', 'my world')).toBe('/maps/my%20world')
	expect(contentDashboard('map')).toBe('/dashboard/maps')
})
test('links required map details to releases and caps map categories', () => {
	const checks = projectSubmissionChecklist({
		type: 'map',
		name: 'Example world',
		summary: 'An example community world',
		description:
			'A complete community world description that exceeds fifty characters.',
		categoryIds: ['one', 'two', 'three', 'four'],
		hasValidatedRelease: false,
	})
	expect(
		checks.find((check) => check.label.includes('categories'))?.complete,
	).toBe(false)
	expect(
		checks.find((check) => check.label.includes('Gameplay')),
	).toMatchObject({ required: true, complete: false, section: '/versions' })
})
