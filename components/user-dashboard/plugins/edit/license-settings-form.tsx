'use client'

import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { LicenseCombobox } from '@/components/user-dashboard/license-combobox'
import {
	errorMessage,
	type PluginForEdit,
	usePluginForEdit,
} from '@/components/user-dashboard/plugins/edit/plugin-edit-data'
import {
	SaveChangesButton,
	SettingsSection,
	SettingsSkeleton,
} from '@/components/user-dashboard/settings-section'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { LICENSE_CATALOG_SOURCE } from '@/lib/licenses'

export function PluginLicenseSettingsForm({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const plugin = usePluginForEdit(draftId)
	if (plugin === undefined) {
		return <SettingsSkeleton />
	}
	return <LicenseForm key={plugin.draft._id} plugin={plugin} />
}

function LicenseForm({ plugin }: { plugin: PluginForEdit }) {
	const { draft } = plugin
	const saveLicense = useMutation(
		api.functions.plugins.publishing.model.saveLicense,
	)
	const [license, setLicense] = useState(draft.license ?? '')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isDirty = license.trim() !== (draft.license ?? '')
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	return (
		<SettingsSection
			description="Set the license shown on your plugin page"
			footer={
				<SaveChangesButton
					disabled={!isDirty}
					isSubmitting={isSubmitting}
				/>
			}
			onSubmit={async (event) => {
				event.preventDefault()
				setIsSubmitting(true)
				try {
					await saveLicense({
						draftId: draft._id,
						license: license.trim() || undefined,
						licenseCustom: draft.licenseCustom,
					})
					toast.success('License saved!')
				} catch (error) {
					toast.error(errorMessage(error))
				} finally {
					setIsSubmitting(false)
				}
			}}
			title="License"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="plugin-license">License</FieldLabel>
					<FieldDescription>
						Search licenses from{' '}
						<a
							className="underline underline-offset-4"
							href={LICENSE_CATALOG_SOURCE}
							rel="noreferrer noopener"
							target="_blank"
						>
							Choose a License
						</a>{' '}
						by name or SPDX identifier. It starts as the license
						GitHub found in your repository.
					</FieldDescription>
					<LicenseCombobox
						disabled={isSubmitting}
						id="plugin-license"
						onChange={setLicense}
						value={license}
					/>
				</Field>
			</FieldGroup>
		</SettingsSection>
	)
}
