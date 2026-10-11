import type { RepositoryFile, RepositorySnapshot } from './types'

function normalizePath(path: string) {
	return path
		.replaceAll('\\', '/')
		.replace(/^\.\/+/, '')
		.replace(/\/+/g, '/')
}

export function createRepositorySnapshot(
	fullName: string,
	defaultBranch: string,
	files: readonly RepositoryFile[],
): RepositorySnapshot {
	return {
		fullName,
		defaultBranch,
		files: files.map((file) => ({
			...file,
			path: normalizePath(file.path),
		})),
	}
}

export function findFile(snapshot: RepositorySnapshot, path: string) {
	const normalized = normalizePath(path)
	return snapshot.files.find((file) => file.path === normalized)
}

export function findFirstFile(
	snapshot: RepositorySnapshot,
	paths: readonly string[],
) {
	for (const path of paths) {
		const file = findFile(snapshot, path)
		if (file) {
			return file
		}
	}
	return undefined
}

export function hasFile(snapshot: RepositorySnapshot, path: string) {
	return findFile(snapshot, path) !== undefined
}

export function hasFileMatching(snapshot: RepositorySnapshot, pattern: RegExp) {
	return snapshot.files.some((file) => pattern.test(file.path))
}

export function readFile(snapshot: RepositorySnapshot, path: string) {
	return findFile(snapshot, path)?.content
}

export function readFirstFile(
	snapshot: RepositorySnapshot,
	paths: readonly string[],
) {
	return findFirstFile(snapshot, paths)?.content
}

export function hasContentMatching(
	snapshot: RepositorySnapshot,
	paths: readonly string[],
	pattern: RegExp,
) {
	const content = readFirstFile(snapshot, paths)
	return content ? pattern.test(content) : false
}
