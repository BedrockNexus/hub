'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
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

// Matches publishing/model:saveCategories.
const MAX_CATEGORIES = 3

export function PluginCategoriesSettingsForm({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const plugin = usePluginForEdit(draftId)
	const categories = useQuery(api.functions.plugins.categories.list, {})
	if (plugin === undefined || categories === undefined) {
		return <SettingsSkeleton />
	}
	return (
		<CategoriesForm
			categories={categories}
			key={plugin.draft._id}
			plugin={plugin}
		/>
	)
}

function CategoriesForm({
	plugin,
	categories,
}: {
	plugin: PluginForEdit
	categories: {
		_id: Id<'pluginCategories'>
		name: string
		description?: string
	}[]
}) {
	const { draft } = plugin
	const saveCategories = useMutation(
		api.functions.plugins.publishing.model.saveCategories,
	)
	const saved = draft.categoryIds ?? []
	const [selected, setSelected] = useState<Id<'pluginCategories'>[]>(saved)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isDirty =
		selected.length !== saved.length ||
		selected.some((id) => !saved.includes(id))
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	const toggle = (id: Id<'pluginCategories'>) =>
		setSelected((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		)

	return (
		<SettingsSection
			description="Help people find your plugin in listings"
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
					await saveCategories({
						draftId: draft._id,
						categoryIds: selected,
					})
					toast.success('Categories saved!')
				} catch (error) {
					toast.error(errorMessage(error))
				} finally {
					setIsSubmitting(false)
				}
			}}
			title="Categories"
		>
			<Field>
				<FieldLabel>Categories</FieldLabel>
				<FieldDescription>
					Pick up to {MAX_CATEGORIES}. They apply as soon as you save.
				</FieldDescription>
				{categories.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No plugin categories have been set up yet.
					</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{categories.map((category) => {
							const active = selected.includes(category._id)
							return (
								<Button
									aria-pressed={active}
									disabled={
										isSubmitting ||
										(!active &&
											selected.length >= MAX_CATEGORIES)
									}
									key={category._id}
									onClick={() => toggle(category._id)}
									size="sm"
									title={category.description}
									type="button"
									variant={active ? 'default' : 'outline'}
								>
									{category.name}
								</Button>
							)
						})}
					</div>
				)}
			</Field>
		</SettingsSection>
	)
}
