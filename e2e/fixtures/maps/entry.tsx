import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useForm } from 'react-hook-form'
import { MapReleaseDetails } from '@/components/projects/detail/map-release-details'
import { MapValidationSummary } from '@/components/projects/detail/map-validation-summary'
import { Button } from '@/components/ui/button'
import { MapReleaseFields } from '@/components/user-dashboard/projects/versions/map-release-fields'
import { MAP_RELEASE_DEFAULTS } from '@/lib/map-release-metadata'
import {
	createVersionFormSchema,
	type VersionFormData,
} from '@/lib/schemas/projects'
import '@/app/globals.css'

function Fixture() {
	const [saved, setSaved] = useState<VersionFormData>()
	const form = useForm<VersionFormData>({
		resolver: zodResolver(createVersionFormSchema('map')),
		defaultValues: {
			version: '1.0.0',
			uploadId: 'fixture-upload',
			fileName: 'fixture.mcworld',
			fileSize: 53_915,
			gameVersions: ['1.21.0'],
			releaseMetadata: structuredClone(MAP_RELEASE_DEFAULTS),
		},
	})
	return (
		<main className="mx-auto max-w-3xl space-y-6 p-5">
			<h1 className="font-semibold text-2xl">
				Maps component test fixture
			</h1>
			<form className="space-y-5" onSubmit={form.handleSubmit(setSaved)}>
				<MapReleaseFields disabled={false} form={form} />
				<Button type="submit">Save fixture release</Button>
			</form>
			<p role="status">{saved ? 'Saved' : 'Not saved'}</p>
			<MapReleaseDetails
				metadata={saved?.releaseMetadata}
				sha256={'a'.repeat(64)}
				version={saved?.version}
			/>
			{saved ? (
				<MapValidationSummary
					report={{
						type: 'map',
						schemaVersion: 1,
						validatorVersion: 'maps-offline-1',
						policyVersion: 'maps-evaluation-1',
						fileSize: 53_915,
						sha256: 'a'.repeat(64),
						sourceEtag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
						entryCount: 8,
						totalUncompressedSize: 63_390,
						world: {
							storageVersion: 9,
							commandBlocksEnabled: true,
							experiments: ['example_feature'],
						},
						packs: [
							{
								uuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
								version: [1, 0, 0],
								kind: 'resource',
								path: 'resource_packs/example',
								moduleTypes: ['resources'],
								minEngineVersion: [1, 21, 0],
								scriptEntries: [],
								dependencies: [],
								engineDependencies: [],
							},
						],
						warnings: [],
					}}
				/>
			) : null}
		</main>
	)
}
const root = document.getElementById('root')
if (root) {
	createRoot(root).render(<Fixture />)
}
