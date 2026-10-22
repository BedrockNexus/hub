'use client'

import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import {
	errorMessage,
	type PluginForEdit,
	PluginReviewNotice,
	repositoryUrlBase,
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
import {
	DESCRIPTION_MAX_LENGTH,
	projectMetadataSchema,
} from '@/lib/plugins/publishing/metadata'

export function PluginDescriptionSettingsForm({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const plugin = usePluginForEdit(draftId)
	if (plugin === undefined) {
		return <SettingsSkeleton />
	}
	return <DescriptionForm key={plugin.draft._id} plugin={plugin} />
}

function DescriptionForm({ plugin }: { plugin: PluginForEdit }) {
	const { draft } = plugin
	const saveMetadata = useMutation(
		api.functions.plugins.publishing.model.saveMetadata,
	)
	const [description, setDescription] = useState(draft.description ?? '')
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isDirty = description !== (draft.description ?? '')
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	return (
		<SettingsSection
			description="The long description on your plugin page, written in Markdown like a GitHub README"
			footer={
				<SaveChangesButton
					disabled={!isDirty || plugin.locked}
					isSubmitting={isSubmitting}
				/>
			}
			onSubmit={async (event) => {
				event.preventDefault()
				const result = projectMetadataSchema.safeParse({
					name: draft.name,
					slug: draft.slug,
					summary: draft.summary,
					description: description || undefined,
				})
				if (!result.success) {
					setError(
						result.error.issues[0]?.message ??
							'Check the description.',
					)
					return
				}
				setError(null)
				setIsSubmitting(true)
				try {
					await saveMetadata({ draftId: draft._id, ...result.data })
					toast.success('Description saved!')
				} catch (saveError) {
					toast.error(errorMessage(saveError))
				} finally {
					setIsSubmitting(false)
				}
			}}
			title="Description"
		>
			<PluginReviewNotice plugin={plugin} />
			<FieldGroup>
				<Field>
					<MarkdownEditor
						disabled={plugin.locked || isSubmitting}
						maxLength={DESCRIPTION_MAX_LENGTH}
						minHeight="24rem"
						onChange={setDescription}
						placeholder="Describe your plugin in detail..."
						relativeUrlBase={repositoryUrlBase(plugin.repository)}
						value={description}
					/>
					{error ? <FieldError>{error}</FieldError> : null}
				</Field>
			</FieldGroup>
		</SettingsSection>
	)
}
