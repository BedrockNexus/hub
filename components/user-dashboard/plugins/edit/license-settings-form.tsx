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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
	const [licenseCustom, setLicenseCustom] = useState(
		draft.licenseCustom ?? '',
	)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isDirty =
		license.trim() !== (draft.license ?? '') ||
		licenseCustom.trim() !== (draft.licenseCustom ?? '')
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
						licenseCustom: licenseCustom.trim() || undefined,
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
						SPDX identifier or short license name. It starts as the
						license GitHub found in your repository.
					</FieldDescription>
					<Input
						disabled={isSubmitting}
						id="plugin-license"
						maxLength={80}
						onChange={(event) => setLicense(event.target.value)}
						placeholder="MIT, GPL-3.0, All Rights Reserved"
						value={license}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="plugin-license-custom">
						Custom License Notes
					</FieldLabel>
					<FieldDescription>
						Optional terms or attribution notes for custom licenses
					</FieldDescription>
					<Textarea
						className="min-h-32"
						disabled={isSubmitting}
						id="plugin-license-custom"
						maxLength={2000}
						onChange={(event) =>
							setLicenseCustom(event.target.value)
						}
						placeholder="Add custom license terms or credits..."
						value={licenseCustom}
					/>
				</Field>
			</FieldGroup>
		</SettingsSection>
	)
}
