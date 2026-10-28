import { S3Client } from '@aws-sdk/client-s3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal, components } from '../../_generated/api'
import {
	createTest,
	insertProject,
	insertRelease,
	signIn,
} from '../../test.setup'
import { uploadsR2, cdnR2 } from '../../lib/r2'
import { type MapReleaseMetadata } from '../../../lib/map-release-metadata'
import { type MapValidationReport } from '../../../lib/map-validation-report'

const etag = '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"'
const metadata: MapReleaseMetadata = {
	type: 'map',
	schemaVersion: 1,
	players: { min: 1, max: 4 },
	gameplay: 'Complete all checkpoints in this parkour course.',
	installation: 'Open this exported world with Minecraft, then choose Play.',
	experiments: { required: false, names: [] },
	requirements: { commandBlocksRequired: true, cheatsRequired: false },
	bundledPacks: [],
}
const report: MapValidationReport = {
	type: 'map',
	schemaVersion: 1,
	validatorVersion: 'maps-offline-1',
	policyVersion: 'maps-evaluation-1',
	fileSize: 53915,
	sha256: 'a'.repeat(64),
	sourceEtag: etag,
	entryCount: 8,
	totalUncompressedSize: 63390,
	world: { storageVersion: 9, commandBlocksEnabled: true },
	packs: [],
	warnings: [],
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
async function setup() {
	const t = createTest()
	const owner = await signIn(t, 'map-owner')
	const moderator = await signIn(t, 'map-moderator', 'admin')
	const outsider = await signIn(t, 'map-outsider')
	const categoryId = await t.run((ctx) =>
		ctx.db.insert('projectCategories', {
			projectType: 'map',
			name: 'Parkour',
			slug: 'parkour',
			sortOrder: 0,
			isActive: true,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}),
	)
	const projectId = await insertProject(t, {
		slug: 'test-map',
		type: 'map',
		ownerId: owner.userId,
		createdBy: owner.userId,
		status: 'draft',
		moderationStatus: 'pending',
		summary: 'A complete parkour world for the community',
		description:
			'A complete Bedrock parkour world with detailed installation instructions and gameplay requirements.',
		categoryIds: [categoryId],
	})
	return { t, owner, moderator, outsider, projectId, categoryId }
}
async function validRelease(
	t: ReturnType<typeof createTest>,
	projectId: Parameters<typeof insertRelease>[1],
	version = '1.0.0',
) {
	return insertRelease(t, projectId, version, {
		artifactType: 'map',
		fileName: 'world.mcworld',
		fileSize: 53915,
		gameVersions: ['1.21.0'],
		releaseMetadata: metadata,
		mapValidationReport: report,
		sealedR2Key: 'uploads/sealed.mcworld',
		sealedEtag: etag,
		uploadR2Key: 'uploads/sealed.mcworld',
		r2Key: 'uploads/sealed.mcworld',
		cdnR2Key: undefined,
		validationStatus: 'valid',
		reviewStatus: 'pending',
	})
}

describe('Maps backend integration', () => {
	it.each(['map', 'addon', 'resource_pack'] as const)('awaits persisted upload metadata for %s and refuses foreign or expired reservations', async (type) => {
		const { t, owner, outsider, projectId } = await setup()
		await t.run(ctx => ctx.db.patch(projectId, { type }))
		const uploadId = await t.run(ctx => ctx.db.insert('projectArtifactUploads', {
			projectId, userId: owner.userId, projectType: type, version: '1.0.0', artifactId: 'readiness', r2Key: 'uploads/readiness', fileName: 'fixture', declaredFileSize: 100, maxFileSize: 1024, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 60_000,
		}))
		let releaseSync!: () => void
		const sync = vi.spyOn(uploadsR2, 'syncMetadata').mockImplementation(() => new Promise<void>(resolve => { releaseSync = resolve }))
		const get = vi.spyOn(uploadsR2, 'getMetadata').mockResolvedValue({ bucket: 'private', bucketLink: '', key: 'uploads/readiness', lastModified: '', link: '', url: '', size: 100 })
		await expect(outsider.action(api.functions.projects.artifactDelivery.completeUpload, { uploadId })).rejects.toThrow('permission')
		await expect(t.action(api.functions.projects.artifactDelivery.completeUpload, { uploadId })).rejects.toThrow()
		expect(sync).not.toHaveBeenCalled()
		let settled = false
		const pending = owner.action(api.functions.projects.artifactDelivery.completeUpload, { uploadId }).then(value => { settled = true; return value })
		await vi.waitFor(() => expect(sync).toHaveBeenCalledOnce())
		expect(settled).toBe(false)
		expect(get).not.toHaveBeenCalled()
		releaseSync()
		await expect(pending).resolves.toBeNull()
		expect(get).toHaveBeenCalledOnce()
		sync.mockResolvedValue(undefined)
		get.mockResolvedValue(null)
		await expect(owner.action(api.functions.projects.artifactDelivery.completeUpload, { uploadId })).rejects.toThrow('file size')
		await t.run(ctx => ctx.db.patch(uploadId, { expiresAt: 1 }))
		await expect(owner.action(api.functions.projects.artifactDelivery.completeUpload, { uploadId })).rejects.toThrow('expired')
		await t.run(ctx => ctx.db.patch(uploadId, { expiresAt: Date.now() + 60_000, status: 'consumed' }))
		await expect(owner.action(api.functions.projects.artifactDelivery.completeUpload, { uploadId })).rejects.toThrow('unavailable')
	})
	it('creates an ordinary map draft only with the backend switch enabled', async () => {
		const { t, owner, categoryId } = await setup()
		vi.stubEnv('MAPS_PUBLISHING_ENABLED', 'true')
		const draft = await owner.mutation(api.functions.projects.projects.create, { type: 'map', name: 'Enabled map draft', summary: 'An adventure world ready for editing', description: 'A complete Bedrock adventure world with its own installation instructions.', categoryIds: [categoryId], ownerType: 'user', ownerId: '__self__' })
		expect(await t.run(ctx => ctx.db.get(draft.id))).toMatchObject({ type: 'map', status: 'draft', ownerId: owner.userId })
		await expect(owner.mutation(api.functions.projects.projects.update, { id: draft.id, type: 'addon' })).rejects.toThrow('content type cannot be changed')
		const addon = await insertProject(t, { slug: 'existing-addon', ownerId: owner.userId, createdBy: owner.userId })
		await expect(owner.mutation(api.functions.projects.projects.update, { id: addon, type: 'map' })).rejects.toThrow('content type cannot be changed')
	})
	it('sends sealed identity to the Maps validator and applies the bounded report', async () => {
		const { t, projectId } = await setup()
		const releaseId = await validRelease(t, projectId)
		await t.run(ctx => ctx.db.patch(releaseId, { validationStatus: 'pending', mapValidationReport: undefined }))
		vi.stubEnv('ARTIFACT_VALIDATOR_URL', 'https://validator.example')
		vi.stubEnv('ARTIFACT_VALIDATOR_API_KEY', 'test-only-key')
		vi.spyOn(uploadsR2, 'getUrl').mockResolvedValue('https://private.example/sealed.mcworld')
		const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ valid: true, report }))
		await t.action(internal.functions.projects.artifactValidation.validateVersion, { versionId: releaseId })
		expect(fetch.mock.calls[0]?.[0]).toBe('https://validator.example/artifact-validate/maps')
		expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toMatchObject({ type: 'map', sourceEtag: etag, fileSize: 53915, downloadUrl: 'https://private.example/sealed.mcworld' })
		expect(await t.run(ctx => ctx.db.get(releaseId))).toMatchObject({ validationStatus: 'valid', mapValidationReport: report, reviewStatus: 'pending' })
	})
	it('applies organization management permissions to Maps releases', async () => {
		const { t, owner, outsider, projectId } = await setup()
		const org = await t.mutation(components.betterAuth.adapter.create, { input: { model: 'organization', data: { name: 'Map creators', slug: 'map-creators', createdAt: Date.now() } } })
		await t.mutation(components.betterAuth.adapter.create, { input: { model: 'member', data: { organizationId: org._id as string, userId: owner.userId, role: 'owner', createdAt: Date.now() } } })
		await t.run(ctx => ctx.db.patch(projectId, { ownerType: 'organization', ownerId: org._id as string }))
		const releaseId = await validRelease(t, projectId)
		expect(await owner.query(api.functions.projects.versions.list, { projectId })).toHaveLength(1)
		await expect(outsider.query(api.functions.projects.versions.list, { projectId })).rejects.toThrow()
		await expect(outsider.mutation(api.functions.projects.versions.retryValidation, { versionId: releaseId })).rejects.toThrow()
	})
	it('saves catalog-checked requirements once and rejects reused or foreign reservations', async () => {
		const { t, owner, outsider, projectId } = await setup()
		await t.run(async ctx => { for (const version of ['1.21.0', '26.50', '1.26.50.4']) await ctx.db.insert('gameVersions', { version, isActive: true, createdAt: Date.now() }) })
		const uploadId = await t.run((ctx) =>
			ctx.db.insert('projectArtifactUploads', {
				projectId,
				userId: owner.userId,
				projectType: 'map',
				version: '1.0.0',
				artifactId: 'test-artifact',
				r2Key: 'uploads/staging.mcworld',
				fileName: 'world.mcworld',
				declaredFileSize: 53915,
				maxFileSize: 512 * 1024 * 1024,
				status: 'pending',
				createdAt: Date.now(),
				expiresAt: Date.now() + 60_000,
			}),
		)
		vi.spyOn(uploadsR2, 'getMetadata').mockResolvedValue({
			bucket: 'private',
			bucketLink: '',
			key: 'uploads/staging.mcworld',
			lastModified: '',
			link: '',
			url: '',
			size: 53915,
		})
		const args = {
			projectId,
			uploadId,
			version: '1.0.0',
			gameVersions: ['1.21.0', '26.50', '1.26.50.4'],
			releaseMetadata: metadata,
		}
		await expect(
			outsider.mutation(api.functions.projects.versions.create, args),
		).rejects.toThrow()
		await expect(
			owner.mutation(api.functions.projects.versions.create, {
				...args,
				releaseMetadata: undefined,
			}),
		).rejects.toThrow()
		await expect(
			owner.mutation(api.functions.projects.versions.create, {
				...args,
				gameVersions: ['99.99.99'],
			}),
		).rejects.toThrow()
		const created = await owner.mutation(
			api.functions.projects.versions.create,
			args,
		)
		expect(created.ok).toBe(true)
		if (created.ok)
			expect(
				await t.run((ctx) => ctx.db.get(created.versionId)),
			).toMatchObject({
				artifactType: 'map',
				releaseMetadata: metadata,
				reviewStatus: 'pending',
				validationStatus: 'pending',
			})
		await expect(
			owner.mutation(api.functions.projects.versions.create, args),
		).rejects.toThrow('upload is invalid')
	})
	it('refuses changed upload bytes when conditional sealing fails', async () => {
		const { t, projectId } = await setup()
		const releaseId = await validRelease(t, projectId)
		await t.run((ctx) =>
			ctx.db.patch(releaseId, {
				validationStatus: 'pending',
				sealedEtag: undefined,
				sealedR2Key: undefined,
				uploadR2Key: 'uploads/source.mcworld',
			}),
		)
		const attempt = await t.mutation(
			internal.functions.projects.artifactValidation.markValidating,
			{ versionId: releaseId },
		)
		vi.spyOn(S3Client.prototype, 'send')
			.mockImplementationOnce(
				() =>
					Promise.resolve({
						ETag: etag,
						ContentLength: 53915,
					}) as never,
			)
			.mockImplementationOnce(
				() => Promise.reject(new Error('PreconditionFailed')) as never,
			)
		await expect(
			t.action(internal.functions.projects.artifactDelivery.sealVersion, {
				versionId: releaseId,
				token: attempt!.token,
			}),
		).rejects.toThrow('PreconditionFailed')
		expect(
			(await t.run((ctx) => ctx.db.get(releaseId)))?.sealedEtag,
		).toBeUndefined()
		expect(
			await t.query(
				internal.functions.projects.artifactValidation
					.getVersionForPromotion,
				{ versionId: releaseId },
			),
		).toBeNull()
	})
	it('drops a seal completion after deletion starts', async () => {
		const { t, projectId } = await setup()
		const releaseId = await validRelease(t, projectId)
		await t.run((ctx) =>
			ctx.db.patch(releaseId, {
				validationStatus: 'pending',
				sealedR2Key: undefined,
				sealedEtag: undefined,
			}),
		)
		const attempt = await t.mutation(
			internal.functions.projects.artifactValidation.markValidating,
			{ versionId: releaseId },
		)
		const key = await t.mutation(
			internal.functions.projects.artifactValidation.reserveSeal,
			{ versionId: releaseId, token: attempt!.token },
		)
		expect(
			await t.mutation(
				internal.functions.projects.artifactValidation.reserveSeal,
				{ versionId: releaseId, token: attempt!.token },
			),
		).toBeNull()
		await t.run((ctx) =>
			ctx.db.patch(releaseId, { deletionRequestedAt: Date.now() }),
		)
		expect(
			await t.mutation(
				internal.functions.projects.artifactValidation.recordSeal,
				{
					versionId: releaseId,
					token: attempt!.token,
					key: key!,
					etag,
				},
			),
		).toBe(false)
	})
	it('keeps public creation blocked while retaining correct Maps routes/types', async () => {
		const { owner, categoryId } = await setup()
		await expect(
			owner.mutation(api.functions.projects.projects.create, {
				type: 'map',
				name: 'Another map',
				summary: 'A complete map for the community',
				description:
					'This is a complete description of a world with at least fifty characters.',
				categoryIds: [categoryId],
				ownerType: 'user',
				ownerId: '__self__',
			}),
		).rejects.toThrow('Maps creation is not enabled')
	})
	it('rejects legacy-state Maps, foreign releases and self-approval', async () => {
		const { t, projectId, owner, moderator, outsider } = await setup()
		const releaseId = await insertRelease(t, projectId, 'legacy', {
			fileName: 'world.mcworld',
			validationStatus: undefined,
			reviewStatus: undefined,
		})
		await expect(
			owner.mutation(api.functions.projects.projects.update, {
				id: projectId,
				status: 'under_review',
			}),
		).rejects.toThrow('Upload and validate')
		const validId = await validRelease(t, projectId)
		await expect(
			outsider.mutation(
				api.functions.projects.versions.generateVersionUploadUrl,
				{
					projectId,
					version: '2.0.0',
					fileName: 'world.mcworld',
					fileSize: 53915,
				},
			),
		).rejects.toThrow()
		await t.run((ctx) =>
			ctx.db.patch(projectId, { ownerId: moderator.userId }),
		)
		await expect(
			moderator.mutation(api.functions.projects.versions.reviewRelease, {
				versionId: validId,
				decision: 'approved',
			}),
		).rejects.toThrow('own project')
		await t.run((ctx) =>
			ctx.db.patch(projectId, {
				status: 'published',
				moderationStatus: 'approved',
			}),
		)
		expect(
			await t.query(api.functions.projects.versions.listPublic, {
				projectId,
			}),
		).toEqual([])
		expect(
			await t.query(
				internal.functions.projects.artifactValidation
					.getVersionForPromotion,
				{ versionId: releaseId },
			),
		).toBeNull()
	})
	it('binds reports to the sealed object and ignores old attempts and deletion callbacks', async () => {
		const { t, projectId } = await setup()
		const releaseId = await validRelease(t, projectId)
		await t.run((ctx) =>
			ctx.db.patch(releaseId, {
				validationStatus: 'pending',
				mapValidationReport: undefined,
			}),
		)
		const first = await t.mutation(
			internal.functions.projects.artifactValidation.markValidating,
			{ versionId: releaseId },
		)
		const second = await t.mutation(
			internal.functions.projects.artifactValidation.markValidating,
			{ versionId: releaseId },
		)
		await t.mutation(
			internal.functions.projects.artifactValidation
				.applyValidationResult,
			{
				versionId: releaseId,
				token: first!.token,
				status: 'valid',
				mapReport: report,
				deleteArtifact: false,
			},
		)
		expect(
			(await t.run((ctx) => ctx.db.get(releaseId)))?.validationStatus,
		).toBe('validating')
		await expect(
			t.mutation(
				internal.functions.projects.artifactValidation
					.applyValidationResult,
				{
					versionId: releaseId,
					token: second!.token,
					status: 'valid',
					mapReport: { ...report, sourceEtag: 'changed' },
					deleteArtifact: false,
				},
			),
		).rejects.toThrow('identity mismatch')
		await t.mutation(
			internal.functions.projects.artifactValidation
				.applyValidationResult,
			{
				versionId: releaseId,
				token: second!.token,
				status: 'valid',
				mapReport: report,
				deleteArtifact: false,
			},
		)
		await t.mutation(
			internal.functions.projects.artifactValidation
				.applyValidationResult,
			{
				versionId: releaseId,
				token: second!.token,
				status: 'invalid',
				deleteArtifact: true,
			},
		)
		expect(
			(await t.run((ctx) => ctx.db.get(releaseId)))?.validationStatus,
		).toBe('valid')
		await t.run((ctx) =>
			ctx.db.patch(releaseId, {
				validationStatus: 'validating',
				deletionRequestedAt: Date.now(),
			}),
		)
		await t.mutation(
			internal.functions.projects.artifactValidation
				.applyValidationResult,
			{
				versionId: releaseId,
				token: second!.token,
				status: 'valid',
				mapReport: report,
				deleteArtifact: false,
			},
		)
		expect(
			(await t.run((ctx) => ctx.db.get(releaseId)))?.validationStatus,
		).toBe('validating')
	})
	it('conditionally seals writable uploads under a distinct server key', async () => {
		const { t, projectId } = await setup()
		const releaseId = await validRelease(t, projectId)
		await t.run((ctx) =>
			ctx.db.patch(releaseId, {
				validationStatus: 'pending',
				sealedEtag: undefined,
				sealedR2Key: undefined,
				uploadR2Key: 'uploads/source.mcworld',
			}),
		)
		const attempt = await t.mutation(
			internal.functions.projects.artifactValidation.markValidating,
			{ versionId: releaseId },
		)
		// SDK send has promise and callback overloads; Vitest selects the latter.
		const send = vi
			.spyOn(S3Client.prototype, 'send')
			.mockImplementation(
				() =>
					Promise.resolve({
						ETag: etag,
						ContentLength: 53915,
					}) as never,
			)
		vi.spyOn(uploadsR2, 'syncMetadata').mockResolvedValue(undefined)
		const result = await t.action(
			internal.functions.projects.artifactDelivery.sealVersion,
			{ versionId: releaseId, token: attempt!.token },
		)
		expect(result?.key).not.toBe('uploads/source.mcworld')
		const inputs = send.mock.calls.map((call) => call[0].input)
		expect(inputs).toContainEqual(
			expect.objectContaining({
				CopySourceIfMatch: etag,
				Key: result?.key,
			}),
		)
		expect(await t.run((ctx) => ctx.db.get(releaseId))).toMatchObject({
			sealedEtag: etag,
			uploadR2Key: result?.key,
			stagingR2Key: 'uploads/source.mcworld',
		})
	})
	it('keeps the old approved snapshot visible during rejected updates', async () => {
		const { t, projectId, owner, moderator } = await setup()
		const releaseId = await validRelease(t, projectId)
		await owner.mutation(api.functions.projects.projects.update, {
			id: projectId,
			status: 'under_review',
		})
		await moderator.mutation(api.functions.projects.projects.adminUpdate, {
			id: projectId,
			status: 'published',
		})
		await t.run((ctx) =>
			ctx.db.patch(releaseId, {
				cdnR2Key: 'downloads/world.mcworld',
				r2Key: 'downloads/world.mcworld',
			}),
		)
		const updateId = await validRelease(t, projectId, '2.0.0')
		await t.run((ctx) =>
			ctx.db.patch(updateId, {
				releaseMetadata: { ...metadata, players: { min: 2, max: 8 } },
			}),
		)
		await moderator.mutation(
			api.functions.projects.versions.reviewRelease,
			{
				versionId: updateId,
				decision: 'rejected',
				reason: 'Needs corrections',
			},
		)
		const publicReleases = await t.query(
			api.functions.projects.versions.listPublic,
			{ projectId },
		)
		expect(publicReleases).toHaveLength(1)
		expect(publicReleases[0]).toMatchObject({
			version: '1.0.0',
			releaseMetadata: { players: { min: 1, max: 4 } },
		})
	})
	it('refuses late promotion after unpublish and retains the private sealed bytes', async () => {
		const { t, projectId } = await setup()
		const releaseId = await validRelease(t, projectId)
		await t.run((ctx) =>
			ctx.db.patch(releaseId, { reviewStatus: 'approved' }),
		)
		const removeCdn = vi
			.spyOn(cdnR2, 'deleteObject')
			.mockResolvedValue(undefined)
		const removePrivate = vi
			.spyOn(uploadsR2, 'deleteObject')
			.mockResolvedValue(undefined)
		await t.mutation(
			internal.functions.projects.artifactValidation.finalizePromotion,
			{
				versionId: releaseId,
				uploadKey: 'uploads/sealed.mcworld',
				cdnKey: 'downloads/world.mcworld',
				sourceEtag: etag,
			},
		)
		expect(removeCdn).toHaveBeenCalledWith(
			expect.anything(),
			'downloads/world.mcworld',
		)
		expect(removePrivate).not.toHaveBeenCalled()
		expect(
			(await t.run((ctx) => ctx.db.get(releaseId)))?.cdnR2Key,
		).toBeUndefined()
	})
})
