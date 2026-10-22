'use client'

import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PluginIconField } from '@/components/plugins/publishing/plugin-icon-field'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
	errorMessage,
	type PluginForEdit,
	PluginReviewNotice,
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
import { projectMetadataSchema } from '@/lib/plugins/publishing/metadata'

export function PluginGeneralSettingsForm({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const plugin = usePluginForEdit(draftId)
	if (plugin === undefined) {
		return <SettingsSkeleton />
	}
	return <GeneralForm key={plugin.draft._id} plugin={plugin} />
}

function GeneralForm({ plugin }: { plugin: PluginForEdit }) {
	const { draft, repository } = plugin
	const saveMetadata = useMutation(
		api.functions.plugins.publishing.model.saveMetadata,
	)
	const [values, setValues] = useState({
		name: draft.name,
		slug: draft.slug,
		summary: draft.summary,
	})
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isDirty =
		values.name !== draft.name ||
		values.slug !== draft.slug ||
		values.summary !== draft.summary
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	const update = (field: keyof typeof values, value: string) =>
		setValues((current) => ({ ...current, [field]: value }))

	return (
		<SettingsSection
			description="The icon, name and summary people see in listings"
			footer={
				<SaveChangesButton
					disabled={!isDirty || plugin.locked}
					isSubmitting={isSubmitting}
				/>
			}
			onSubmit={async (event) => {
				event.preventDefault()
				const result = projectMetadataSchema.safeParse({
					...values,
					description: draft.description,
				})
				if (!result.success) {
					setError(
						result.error.issues[0]?.message ?? 'Check the details.',
					)
					return
				}
				setError(null)
				setIsSubmitting(true)
				try {
					await saveMetadata({ draftId: draft._id, ...result.data })
					toast.success('General settings saved!')
				} catch (saveError) {
					toast.error(errorMessage(saveError))
				} finally {
					setIsSubmitting(false)
				}
			}}
			title="General"
		>
			<PluginReviewNotice plugin={plugin} />
			<FieldGroup>
				<Field>
					<FieldLabel>Icon</FieldLabel>
					<PluginIconField
						disabled={isSubmitting}
						draftId={draft._id}
						iconUrl={draft.iconUrl}
						name={values.name || draft.name}
						published={plugin.project?.status === 'published'}
					/>
				</Field>
				<div className="grid gap-6 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="plugin-name">Name</FieldLabel>
						<Input
							disabled={plugin.locked || isSubmitting}
							id="plugin-name"
							onChange={(event) =>
								update('name', event.target.value)
							}
							value={values.name}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="plugin-slug">Slug</FieldLabel>
						<Input
							disabled={plugin.locked || isSubmitting}
							id="plugin-slug"
							onChange={(event) =>
								update('slug', event.target.value)
							}
							value={values.slug}
						/>
						<FieldDescription>
							Your plugin’s address: /plugins/
							{values.slug || 'slug'}
						</FieldDescription>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="plugin-summary">Summary</FieldLabel>
					<Input
						disabled={plugin.locked || isSubmitting}
						id="plugin-summary"
						onChange={(event) =>
							update('summary', event.target.value)
						}
						placeholder="One sentence about what the plugin does"
						value={values.summary}
					/>
				</Field>
				<div className="grid gap-6 sm:grid-cols-2">
					<Field>
						<FieldLabel>Server software</FieldLabel>
						<p className="text-sm">
							{plugin.softwareName ?? 'Set by the build workflow'}
						</p>
					</Field>
					<Field>
						<FieldLabel>Repository</FieldLabel>
						<a
							className="truncate text-primary text-sm hover:underline"
							href={repository.htmlUrl}
							rel="noreferrer"
							target="_blank"
						>
							{repository.fullName}
						</a>
					</Field>
				</div>
				{error ? <FieldError>{error}</FieldError> : null}
			</FieldGroup>
		</SettingsSection>
	)
}
