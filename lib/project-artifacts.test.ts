import { describe, expect, test } from 'bun:test'
import {
	buildEntityImageR2ObjectKey,
	buildMediaR2ObjectKey,
	buildOrganizationMediaR2ObjectKey,
	buildProfileMediaR2ObjectKey,
	buildProjectVersionR2ObjectKey,
	buildSiteImageR2ObjectKey,
	buildTemporaryR2ObjectKey,
	isEditorMediaR2Key,
	isEntityImageR2Key,
	isManagedR2Key,
	isOrganizationMediaR2Key,
	isProfileMediaR2Key,
	isSiteImageR2Key,
	isTemporaryR2Key,
} from '../convex/lib/r2Keys'
import {
	getProjectArtifactPolicy,
	normalizeProjectType,
	validateProjectArtifactFile,
} from './project-artifacts'

const SERVER_LOGO_KEY_PATTERN =
	/^media\/servers\/server_123\/logo\/[a-f0-9-]+\.png$/

describe('project artifact policy', () => {
	test.each([
		['addon', 'release.mcaddon'],
		['map', 'world.mcworld'],
		['skin', 'skin.PNG'],
		['resource_pack', 'textures.mcpack'],
	] as const)('accepts the artifact for %s', (type, fileName) => {
		expect(
			validateProjectArtifactFile({ type, fileName, fileSize: 1024 }),
		).toBeNull()
	})

	test('rejects generic zip maps', () => {
		expect(
			validateProjectArtifactFile({
				type: 'map',
				fileName: 'world.zip',
				fileSize: 1024,
			}),
		).toContain('.mcworld')
	})

	test('maps the legacy texture pack type to resource packs', () => {
		expect(normalizeProjectType('texture_pack')).toBe('resource_pack')
		expect(getProjectArtifactPolicy('texture_pack').extensions).toEqual([
			'mcpack',
		])
	})

	test('rejects empty and oversized artifacts', () => {
		expect(
			validateProjectArtifactFile({
				type: 'addon',
				fileName: 'release.mcaddon',
				fileSize: 0,
			}),
		).toContain('empty')
		expect(
			validateProjectArtifactFile({
				type: 'skin',
				fileName: 'skin.png',
				fileSize: 2 * 1024 * 1024 + 1,
			}),
		).toContain('2 MB')
	})

	test('builds entity-first artifact keys without original filenames', () => {
		expect(
			buildProjectVersionR2ObjectKey({
				projectId: 'project_123',
				releaseId: 'release_456',
				artifactId: 'artifact_789',
				fileName: 'My Original World.mcworld',
			}),
		).toBe(
			'artifacts/projects/project_123/releases/release_456/artifact_789.mcworld',
		)
	})

	test('builds and recognizes entity-first media keys', () => {
		const serverLogo = buildEntityImageR2ObjectKey({
			resourceType: 'servers',
			entityId: 'server_123',
			imageKind: 'logo',
			fileName: 'logo.PNG',
		})
		const profileBanner = buildProfileMediaR2ObjectKey({
			userId: 'user_123',
			mediaKind: 'banner',
			fileName: 'banner.webp',
		})
		const organizationBanner = buildOrganizationMediaR2ObjectKey({
			organizationId: 'org_123',
			mediaKind: 'banner',
			fileName: 'banner.jpg',
		})

		expect(serverLogo).toMatch(SERVER_LOGO_KEY_PATTERN)
		expect(
			isEntityImageR2Key({
				key: serverLogo,
				resourceType: 'servers',
				entityId: 'server_123',
				imageKind: 'logo',
			}),
		).toBeTrue()
		expect(
			isProfileMediaR2Key(profileBanner, 'user_123', 'banner'),
		).toBeTrue()
		expect(
			isOrganizationMediaR2Key(organizationBanner, 'org_123', 'banner'),
		).toBeTrue()
	})

	test('builds site, editor, and temporary namespaces', () => {
		const siteLogo = buildSiteImageR2ObjectKey({
			imageKind: 'logo',
			fileName: 'brand.png',
		})
		const editorImage = buildProfileMediaR2ObjectKey({
			userId: 'user_123',
			mediaKind: 'editor-image',
			fileName: 'guide.png',
		})
		const temporary = buildTemporaryR2ObjectKey({
			userId: 'user_123',
			uploadId: 'upload_123',
			assetId: 'asset_123',
			fileName: 'draft.gif',
		})

		expect(isSiteImageR2Key(siteLogo, 'logo')).toBeTrue()
		expect(isEditorMediaR2Key(editorImage, 'user_123')).toBeTrue()
		expect(temporary).toBe('temporary/user_123/upload_123/asset_123.gif')
		expect(isTemporaryR2Key(temporary, 'user_123')).toBeTrue()
	})

	test('buildMediaR2ObjectKey never includes the original filename', () => {
		expect(
			buildMediaR2ObjectKey({
				entityType: 'projects',
				entityId: 'project_123',
				mediaKind: 'gallery',
				assetId: 'asset_123',
				fileName: 'My Screenshot.webp',
			}),
		).toBe('media/projects/project_123/gallery/asset_123.webp')
	})

	test('keeps legacy managed keys recognizable during rollout', () => {
		expect(
			isManagedR2Key('user_123/servers/server_123/logo/legacy-logo.png'),
		).toBeTrue()
		expect(
			isSiteImageR2Key('user_123/site/logo/legacy-logo.png', 'logo'),
		).toBeTrue()
		expect(
			isEditorMediaR2Key(
				'user_123/editor/media/image/legacy-image.png',
				'user_123',
			),
		).toBeTrue()
	})
})
