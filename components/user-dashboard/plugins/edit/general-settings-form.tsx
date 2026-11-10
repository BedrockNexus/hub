'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PluginIconField } from '@/components/plugins/publishing/plugin-icon-field'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CategoryMultiSelect } from '@/components/user-dashboard/fields/category-multi-select'
import {
	errorMessage,
	type PluginForEdit,
	PluginReviewNotice,
	usePluginForEdit,
} from '@/components/user-dashboard/plugins/edit/plugin-edit-data'
import { SaveBar } from '@/components/user-dashboard/save-bar'
import {
	SettingsCard,
	SettingsRow,
} from '@/components/user-dashboard/settings-card'
import {
	SettingsSection,
	SettingsSkeleton,
} from '@/components/user-dashboard/settings-section'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { projectMetadataSchema } from '@/lib/plugins/publishing/metadata'

// Matches publishing/model:saveCategories.
const MAX_CATEGORIES = 3

function sameIds(a: readonly string[], b: readonly string[]) {
	return a.length === b.length && a.every((id) => b.includes(id))
}

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
	const saveCategories = useMutation(
		api.functions.plugins.publishing.model.saveCategories,
	)
	const categories = useQuery(api.functions.plugins.categories.list, {})
	const savedCategoryIds = draft.categoryIds ?? []
	const [categoryIds, setCategoryIds] =
		useState<Id<'pluginCategories'>[]>(savedCategoryIds)
	const categoriesDirty = !sameIds(categoryIds, savedCategoryIds)
	const [values, setValues] = useState({
		name: draft.name,
		slug: draft.slug,
		summary: draft.summary,
	})
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const detailsDirty =
		values.name !== draft.name ||
		values.slug !== draft.slug ||
		values.summary !== draft.summary
	const isDirty = detailsDirty || categoriesDirty
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	const update = (field: keyof typeof values, value: string) =>
		setValues((current) => ({ ...current, [field]: value }))

	return (
		<SettingsSection
			description="How your plugin appears in lists and search."
			footer={
				<SaveBar
					blockedMessage="This plugin is in review, so its details are locked"
					canSave={!plugin.locked}
					dirty={isDirty}
					isSubmitting={isSubmitting}
					onDiscard={() => {
						setValues({
							name: draft.name,
							slug: draft.slug,
							summary: draft.summary,
						})
						setCategoryIds(savedCategoryIds)
						setError(null)
					}}
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
					if (detailsDirty) {
						await saveMetadata({
							draftId: draft._id,
							...result.data,
						})
					}
					if (categoriesDirty) {
						await saveCategories({
							draftId: draft._id,
							categoryIds,
						})
					}
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
			<SettingsCard id="basics" title="Basics">
				<Field className="scroll-mt-24" id="icon">
					<FieldLabel>Icon</FieldLabel>
					<PluginIconField
						disabled={isSubmitting}
						draftId={draft._id}
						iconUrl={draft.iconUrl}
						name={values.name || draft.name}
						published={plugin.project?.status === 'published'}
					/>
				</Field>
				<div className="grid gap-5 sm:grid-cols-2">
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
						<FieldLabel htmlFor="plugin-slug">Address</FieldLabel>
						<Input
							aria-describedby="plugin-slug-hint"
							disabled={plugin.locked || isSubmitting}
							id="plugin-slug"
							onChange={(event) =>
								update('slug', event.target.value)
							}
							value={values.slug}
						/>
						<FieldDescription id="plugin-slug-hint">
							/plugins/{values.slug || 'your-plugin'}
						</FieldDescription>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="plugin-summary">
						One-line summary
					</FieldLabel>
					<Input
						disabled={plugin.locked || isSubmitting}
						id="plugin-summary"
						onChange={(event) =>
							update('summary', event.target.value)
						}
						placeholder="What the plugin does, in one sentence"
						value={values.summary}
					/>
				</Field>
				{error ? <FieldError>{error}</FieldError> : null}
			</SettingsCard>
			<SettingsCard id="categories" title="Discovery">
				<CategoryMultiSelect
					categories={categories}
					description={`Pick up to ${MAX_CATEGORIES}. Changes go live with your next approved version.`}
					disabled={plugin.locked || isSubmitting}
					max={MAX_CATEGORIES}
					onChange={setCategoryIds}
					value={categoryIds}
				/>
			</SettingsCard>
			<SettingsCard flush title="Source">
				<SettingsRow label="Repository">
					<a
						className="min-w-0 truncate font-mono text-primary text-sm hover:underline"
						href={repository.htmlUrl}
						rel="noreferrer"
						target="_blank"
					>
						{repository.fullName}
					</a>
				</SettingsRow>
				<SettingsRow
					description="Set by the build workflow"
					label="Server software"
				>
					<span className="text-sm">
						{plugin.softwareName ?? 'Not set yet'}
					</span>
				</SettingsRow>
			</SettingsCard>
		</SettingsSection>
	)
}
