import { unzipSync } from 'fflate'

// Larger builds are refused; Altay-sized plugins are a few megabytes.
export const MAX_PLUGIN_FILE_BYTES = 50 * 1024 * 1024

export class ArtifactError extends Error {}

/**
 * The single plugin file inside a `plugin-package` artifact zip. GitHub
 * always zips artifacts, so the workflow's one file comes back wrapped.
 */
export function extractPluginFile(archive: Uint8Array, extension: string) {
	let entries: Record<string, Uint8Array>
	try {
		entries = unzipSync(archive, {
			filter: (file) => !file.name.endsWith('/'),
		})
	} catch {
		throw new ArtifactError('The build artifact is not a valid zip file.')
	}
	const suffix = `.${extension.toLowerCase()}`
	const matches = Object.entries(entries).filter(([name]) =>
		name.toLowerCase().endsWith(suffix),
	)
	if (matches.length !== 1) {
		throw new ArtifactError(
			`The build must contain exactly one ${suffix} file; it has ${matches.length}.`,
		)
	}
	const [path, data] = matches[0] as [string, Uint8Array]
	if (data.byteLength === 0) {
		throw new ArtifactError(`The ${suffix} file in the build is empty.`)
	}
	if (data.byteLength > MAX_PLUGIN_FILE_BYTES) {
		throw new ArtifactError('The plugin file is larger than 50 MB.')
	}
	return { fileName: path.split('/').pop() ?? path, data }
}
