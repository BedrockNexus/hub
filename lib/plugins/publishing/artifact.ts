import { unzipSync } from 'fflate'

// Larger builds are refused; Altay-sized plugins are a few megabytes.
export const MAX_PLUGIN_FILE_BYTES = 50 * 1024 * 1024

export class ArtifactError extends Error {}

/**
 * The single plugin file inside a `plugin-package` artifact zip. GitHub
 * always zips artifacts, so the workflow's one file comes back wrapped. The
 * workflow decides the file type (a .phar, a .jar, ...); the artifact must
 * hold just that one file.
 */
export function extractPluginFile(archive: Uint8Array) {
	let entries: Record<string, Uint8Array>
	try {
		entries = unzipSync(archive, {
			filter: (file) => !file.name.endsWith('/'),
		})
	} catch {
		throw new ArtifactError('The build artifact is not a valid zip file.')
	}
	const files = Object.entries(entries)
	if (files.length !== 1) {
		throw new ArtifactError(
			`The build must contain exactly one file, the plugin; it has ${files.length}.`,
		)
	}
	const [path, data] = files[0] as [string, Uint8Array]
	if (data.byteLength === 0) {
		throw new ArtifactError('The plugin file in the build is empty.')
	}
	if (data.byteLength > MAX_PLUGIN_FILE_BYTES) {
		throw new ArtifactError('The plugin file is larger than 50 MB.')
	}
	return { fileName: path.split('/').pop() ?? path, data }
}
