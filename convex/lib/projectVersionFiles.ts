import type { Infer } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type {
	releaseFile,
	releaseFinding,
	releaseScriptModule,
} from '../schemas/projects'

type ReleaseFile = Infer<typeof releaseFile>
type ReleaseFinding = Infer<typeof releaseFinding>
type ScriptModule = Infer<typeof releaseScriptModule>

/** The validator's report as it arrives; anything may be missing or odd. */
export interface ValidatorReport {
	type: string
	fileSize: number
	entryCount?: number
	totalUncompressedSize?: number
	manifestCount?: number
	width?: number
	height?: number
	sha256?: string
	checksVersion?: number
	files?: unknown
	filesTruncated?: unknown
	scriptModules?: unknown
	findings?: unknown
}

const MAX_FILES = 5000
// A document holds 1 MiB; leave room for the rest of the row.
const MAX_FILE_LIST_BYTES = 700_000
const MAX_PATH = 400
const MAX_FINDINGS = 20
const MAX_FINDING_PATHS = 10
const MAX_MODULES = 50

const text = (value: unknown, max: number) =>
	typeof value === 'string' ? value.slice(0, max) : undefined
const count = (value: unknown) =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0
		? value
		: undefined
const list = (value: unknown) => (Array.isArray(value) ? value : [])

function fileList(report: ValidatorReport) {
	const files: ReleaseFile[] = []
	let bytes = 0
	let truncated = report.filesTruncated === true
	for (const item of list(report.files)) {
		const row = item as Record<string, unknown>
		const path = text(row?.path, MAX_PATH)
		const size = count(row?.size)
		const crc32 = count(row?.crc32)
		if (!path || size === undefined || crc32 === undefined) continue
		bytes += path.length + 40
		if (files.length >= MAX_FILES || bytes > MAX_FILE_LIST_BYTES) {
			truncated = true
			break
		}
		files.push({ path, size, crc32 })
	}
	return { files, truncated }
}

function findings(report: ValidatorReport) {
	return list(report.findings)
		.slice(0, MAX_FINDINGS)
		.flatMap((item): ReleaseFinding[] => {
			const row = item as Record<string, unknown>
			const code = text(row?.code, 60)
			const message = text(row?.message, 300)
			if (!(code && message)) return []
			const paths = list(row.paths)
				.flatMap((path) => text(path, MAX_PATH) ?? [])
				.slice(0, MAX_FINDING_PATHS)
			return [
				{
					code,
					level: row.level === 'warning' ? 'warning' : 'info',
					message,
					...(paths.length ? { paths } : {}),
				},
			]
		})
}

function scriptModules(report: ValidatorReport) {
	return list(report.scriptModules)
		.slice(0, MAX_MODULES)
		.flatMap((item): ScriptModule[] => {
			const row = item as Record<string, unknown>
			const name = text(row?.name, 100)
			if (!name) return []
			const version = text(row.version, 40)
			return [version ? { name, version } : { name }]
		})
}

/**
 * Splits a validator report into what is kept on the version and its file
 * list, taking only the fields this deployment knows, so a newer validator
 * cannot break validation.
 */
export function storedValidationReport(report: ValidatorReport) {
	const stored = {
		type: text(report.type, 40) ?? 'unknown',
		fileSize: count(report.fileSize) ?? 0,
		entryCount: count(report.entryCount),
		totalUncompressedSize: count(report.totalUncompressedSize),
		manifestCount: count(report.manifestCount),
		width: count(report.width),
		height: count(report.height),
		sha256: text(report.sha256, 128),
	}
	const checksVersion = count(report.checksVersion)
	if (!checksVersion) return { report: stored, files: undefined }
	const listed = fileList(report)
	return {
		report: {
			...stored,
			checksVersion,
			fileCount: listed.files.length,
			scriptModules: scriptModules(report),
			findings: findings(report),
		},
		files: listed,
	}
}

export async function saveVersionFiles(
	ctx: MutationCtx,
	versionId: Id<'projectVersions'>,
	listed: { files: ReleaseFile[]; truncated: boolean } | undefined,
) {
	await deleteVersionFiles(ctx, versionId)
	if (listed) {
		await ctx.db.insert('projectVersionFiles', { versionId, ...listed })
	}
}

export async function deleteVersionFiles(
	ctx: MutationCtx,
	versionId: Id<'projectVersions'>,
) {
	const existing = await ctx.db
		.query('projectVersionFiles')
		.withIndex('by_versionId', (q) => q.eq('versionId', versionId))
		.unique()
	if (existing) await ctx.db.delete(existing._id)
}

export type FileChange = {
	path: string
	change: 'added' | 'changed' | 'removed'
	size: number
}

const MAX_CHANGE_ROWS = 500
const CHANGE_ORDER = { added: 0, changed: 1, removed: 2 }

/** What changed between two versions' file lists. */
export function compareFiles(before: ReleaseFile[], after: ReleaseFile[]) {
	const previous = new Map(before.map((file) => [file.path, file]))
	const changes: FileChange[] = []
	for (const file of after) {
		const old = previous.get(file.path)
		previous.delete(file.path)
		if (!old) changes.push({ path: file.path, change: 'added', size: file.size })
		else if (old.crc32 !== file.crc32 || old.size !== file.size)
			changes.push({ path: file.path, change: 'changed', size: file.size })
	}
	for (const file of previous.values())
		changes.push({ path: file.path, change: 'removed', size: file.size })
	changes.sort(
		(a, b) =>
			CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change] ||
			a.path.localeCompare(b.path),
	)
	const total = (change: FileChange['change']) =>
		changes.filter((row) => row.change === change).length
	return {
		added: total('added'),
		changed: total('changed'),
		removed: total('removed'),
		unchanged: after.length - total('added') - total('changed'),
		rows: changes.slice(0, MAX_CHANGE_ROWS),
		rowsTruncated: changes.length > MAX_CHANGE_ROWS,
	}
}
