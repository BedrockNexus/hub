import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import {
	ambiguousFixture,
	pocketMineFixture,
	powerNukkitGradleFixture,
	powerNukkitMavenFixture,
	unsupportedFixture,
} from './fixtures'
import {
	detectCompatibleAdapters,
	getAdapterById,
	getEnabledAdapters,
} from './registry'
import { createRepositorySnapshot } from './repository'

describe('adapter registry and detection', () => {
	it('exposes the enabled adapters through an explicit registry', () => {
		expect(getEnabledAdapters().map((adapter) => adapter.id)).toEqual([
			'pocketmine-mp',
			'powernukkitx',
		])
		expect(getAdapterById('pocketmine-mp')?.name).toBe('PocketMine-MP')
		expect(getAdapterById('powernukkitx')?.name).toBe('PowerNukkitX')
	})

	it('detects the live-shaped PocketMine fixture with explainable evidence', () => {
		const resolution = detectCompatibleAdapters(pocketMineFixture)

		expect(resolution.kind).toBe('matched')
		if (resolution.kind !== 'matched') {
			throw new Error('Expected a matched PocketMine adapter.')
		}
		expect(resolution.selected).toMatchObject({
			adapterId: 'pocketmine-mp',
			score: 100,
			confidence: 'high',
		})
		expect(
			resolution.selected.signals
				.filter((signal) => signal.matched)
				.map((signal) => signal.id),
		).toEqual([
			'root-plugin-yml',
			'composer-plugin-type',
			'composer-pocketmine-reference',
			'php-sources',
		])
	})

	it.each([
		['Gradle', powerNukkitGradleFixture, 'gradle'],
		['Maven', powerNukkitMavenFixture, 'maven'],
	])('detects and extracts %s PowerNukkitX metadata', (_label, fixture, buildSystem) => {
		const resolution = detectCompatibleAdapters(fixture)
		const adapter = getAdapterById('powernukkitx')

		expect(resolution.kind).toBe('matched')
		expect(adapter?.extractMetadata(fixture)).toMatchObject({
			ok: true,
			metadata: {
				buildSystem,
				apiVersions: ['2.0.0'],
			},
		})
	})

	it('returns unsupported when no adapter reaches the threshold', () => {
		expect(detectCompatibleAdapters(unsupportedFixture)).toMatchObject({
			kind: 'unsupported',
		})
	})

	it('requires a user choice when two adapters have similarly strong evidence', () => {
		const resolution = detectCompatibleAdapters(ambiguousFixture)

		expect(resolution.kind).toBe('ambiguous')
		expect(
			resolution.candidates
				.slice(0, 2)
				.map((candidate) => candidate.adapterId),
		).toEqual(['pocketmine-mp', 'powernukkitx'])
	})
})

describe('metadata and validation', () => {
	it('extracts PocketMine metadata from plugin.yml and composer.json', () => {
		const adapter = getAdapterById('pocketmine-mp')

		expect(adapter?.extractMetadata(pocketMineFixture)).toEqual({
			ok: true,
			metadata: {
				name: 'BedrockNexusExample',
				version: '1.0.0',
				description: 'An example PocketMine-MP plugin.',
				authors: ['BedrockNexus'],
				website: 'https://bedrocknexus.com',
				license: 'MIT',
				apiVersions: ['5.0.0'],
				mainClass: 'BedrockNexus\\ExamplePlugin\\Main',
				buildSystem: 'composer',
			},
			sources: ['plugin.yml', 'composer.json'],
		})
		expect(adapter?.validate(pocketMineFixture)).toEqual({
			valid: true,
			issues: [],
		})
	})

	it('fails validation when the declared main class is absent', () => {
		const brokenPocketMine = createRepositorySnapshot(
			pocketMineFixture.fullName,
			pocketMineFixture.defaultBranch,
			pocketMineFixture.files.filter(
				(file) => file.path !== 'src/Main.php',
			),
		)
		const brokenPowerNukkitX = createRepositorySnapshot(
			powerNukkitGradleFixture.fullName,
			powerNukkitGradleFixture.defaultBranch,
			powerNukkitGradleFixture.files.filter(
				(file) => !file.path.endsWith('.java'),
			),
		)

		expect(
			getAdapterById('pocketmine-mp')?.validate(brokenPocketMine),
		).toMatchObject({
			valid: false,
			issues: [{ code: 'PMMP_MAIN_CLASS_MISSING' }],
		})
		expect(
			getAdapterById('powernukkitx')?.validate(brokenPowerNukkitX),
		).toMatchObject({
			valid: false,
			issues: [{ code: 'PNX_MAIN_CLASS_MISSING' }],
		})
	})
})

describe('workflow generation', () => {
	it('generates the canonical PocketMine workflow snapshot', () => {
		const adapter = getAdapterById('pocketmine-mp')
		const extracted = adapter?.extractMetadata(pocketMineFixture)
		if (!(adapter && extracted?.ok)) {
			throw new Error('PocketMine metadata extraction failed.')
		}

		const workflow = adapter.generateWorkflow({
			metadata: extracted.metadata,
			defaultBranch: pocketMineFixture.defaultBranch,
		})

		expect(parse(workflow.content)).toMatchObject({
			name: 'BedrockNexus Publish',
			on: {
				push: {
					branches: ['**'],
					tags: ['v*'],
				},
			},
			permissions: { contents: 'read' },
			jobs: {
				release: {
					permissions: { contents: 'write' },
				},
			},
		})
		expect(workflow.content).toContain(
			"startsWith(github.ref, 'refs/tags/v')",
		)
		expect(workflow.content).toMatchSnapshot()
	})

	it.each([
		['Gradle', powerNukkitGradleFixture],
		['Maven', powerNukkitMavenFixture],
	])('generates a %s workflow with strict primary-JAR selection', (_label, fixture) => {
		const adapter = getAdapterById('powernukkitx')
		const extracted = adapter?.extractMetadata(fixture)
		if (!(adapter && extracted?.ok)) {
			throw new Error('PowerNukkitX metadata extraction failed.')
		}

		const workflow = adapter.generateWorkflow({
			metadata: extracted.metadata,
			defaultBranch: fixture.defaultBranch,
		})

		expect(workflow.content).toContain('! -name "*-sources.jar"')
		expect(workflow.content).toContain('! -name "*-javadoc.jar"')
		expect(workflow.content).toContain('! -name "*-tests.jar"')
		expect(workflow.content).toContain('! -name "*-plain.jar"')
		expect(workflow.content).toContain('! -name "original-*.jar"')
		expect(workflow.content).toContain(`if [ "\${#jars[@]}" -ne 1 ]`)
		expect(workflow.content).toContain(
			"startsWith(github.ref, 'refs/tags/v')",
		)
		expect(workflow.content).toMatchSnapshot()
	})

	it('accepts only explicitly confirmed, adapter-safe build command overrides', () => {
		const adapter = getAdapterById('powernukkitx')
		const extracted = adapter?.extractMetadata(powerNukkitGradleFixture)
		if (!(adapter && extracted?.ok)) {
			throw new Error('PowerNukkitX metadata extraction failed.')
		}

		expect(() =>
			adapter.generateWorkflow({
				metadata: extracted.metadata,
				defaultBranch: 'main',
				buildCommandOverride: {
					command: './gradlew clean shadowJar',
					userConfirmed: true,
				},
			}),
		).not.toThrow()
		expect(() =>
			adapter.generateWorkflow({
				metadata: extracted.metadata,
				defaultBranch: 'main',
				buildCommandOverride: {
					command: './gradlew clean build; curl https://example.com',
					userConfirmed: true,
				},
			}),
		).toThrow('unsupported shell syntax')
		expect(() =>
			adapter.generateWorkflow({
				metadata: extracted.metadata,
				defaultBranch: 'main',
				buildCommandOverride: {
					command: './gradlew clean build',
					userConfirmed: false,
				},
			}),
		).toThrow('explicitly confirmed')
	})
})
