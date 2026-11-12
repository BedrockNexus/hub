import { describe, expect, it } from 'bun:test'
import { compareGameVersions, versionStanding } from './game-version-standing'
import { parseMinecraftText, plainMinecraftText } from './minecraft-text'

describe('Minecraft formatting', () => {
	it('splits text into coloured, styled runs', () => {
		expect(parseMinecraftText('§6§lCrafty§eLands §7| §aSurvival')).toEqual([
			{
				text: 'Crafty',
				color: '#ffaa00',
				bold: true,
				italic: false,
				obfuscated: false,
			},
			{
				text: 'Lands ',
				color: '#ffff55',
				bold: true,
				italic: false,
				obfuscated: false,
			},
			{
				text: '| ',
				color: '#aaaaaa',
				bold: true,
				italic: false,
				obfuscated: false,
			},
			{
				text: 'Survival',
				color: '#55ff55',
				bold: true,
				italic: false,
				obfuscated: false,
			},
		])
	})

	it('resets with §r and drops unknown codes', () => {
		expect(parseMinecraftText('§l§cHot§r cold§z!')).toEqual([
			{
				text: 'Hot',
				color: '#ff5555',
				bold: true,
				italic: false,
				obfuscated: false,
			},
			{ text: ' cold', bold: false, italic: false, obfuscated: false },
			{ text: '!', bold: false, italic: false, obfuscated: false },
		])
	})

	it('treats m and n as Bedrock colours', () => {
		expect(
			parseMinecraftText('§mRed§nCopper').map((run) => run.color),
		).toEqual(['#971607', '#b4684d'])
	})

	it('gives plain text without codes, even a dangling §', () => {
		expect(plainMinecraftText('§aGreen §lbold§')).toBe('Green bold')
	})
})

describe('game version standing', () => {
	const known = ['1.21.60', '1.21.70', '1.21.80', '1.21.90', '1.21.111']

	it('compares numerically, not as text', () => {
		expect(compareGameVersions('1.21.111', '1.21.90')).toBeGreaterThan(0)
		expect(compareGameVersions('1.21.60', '1.21.60.1')).toBeLessThan(0)
	})

	it('says how many known versions are newer', () => {
		expect(versionStanding('1.21.60', known)).toEqual({
			latest: '1.21.111',
			behind: 4,
		})
		expect(versionStanding('1.21.111', known)).toEqual({
			latest: '1.21.111',
			behind: 0,
		})
		expect(versionStanding('1.22.0', known)).toEqual({
			latest: '1.21.111',
			behind: 0,
		})
	})

	it('reads 1.26.60 as the year-numbered release 26.60', () => {
		expect(versionStanding('1.26.60', ['26.20', '26.23'])).toEqual({
			latest: '26.23',
			behind: 0,
		})
		expect(versionStanding('1.21.130', ['26.20', '26.23'])).toEqual({
			latest: '26.23',
			behind: 2,
		})
	})

	it('gives nothing for missing or odd versions', () => {
		expect(versionStanding(undefined, known)).toBeNull()
		expect(versionStanding('Velocity 3', known)).toBeNull()
		expect(versionStanding('1.21.60', [])).toBeNull()
	})
})
