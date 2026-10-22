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

const LINK_FIELDS = [
	{
		field: 'issuesUrl',
		label: 'Issue tracker',
		placeholder: 'https://',
		description: 'Defaults to the repository’s GitHub issues',
	},
	{ field: 'wikiUrl', label: 'Wiki', placeholder: 'https://' },
	{
		field: 'discordUrl',
		label: 'Discord invite',
		placeholder: 'https://discord.gg/',
	},
	{ field: 'websiteUrl', label: 'Website', placeholder: 'https://' },
	{ field: 'donationUrl', label: 'Donation link', placeholder: 'https://' },
] as const

type LinkField = (typeof LINK_FIELDS)[number]['field']

export function PluginLinksSettingsForm({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const plugin = usePluginForEdit(draftId)
	if (plugin === undefined) {
		return <SettingsSkeleton />
	}
	return <LinksForm key={plugin.draft._id} plugin={plugin} />
}

function LinksForm({ plugin }: { plugin: PluginForEdit }) {
	const { draft } = plugin
	const saveLinks = useMutation(
		api.functions.plugins.publishing.model.saveLinks,
	)
	const saved = Object.fromEntries(
		LINK_FIELDS.map(({ field }) => [field, draft[field] ?? '']),
	) as Record<LinkField, string>
	const [links, setLinks] = useState(saved)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isDirty = LINK_FIELDS.some(
		({ field }) => links[field].trim() !== saved[field],
	)
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	return (
		<SettingsSection
			description="Shown on your plugin page next to the source code. Empty links are hidden"
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
					await saveLinks({
						draftId: draft._id,
						...Object.fromEntries(
							LINK_FIELDS.map(({ field }) => [
								field,
								links[field].trim() || undefined,
							]),
						),
					})
					toast.success('Links saved!')
				} catch (error) {
					toast.error(errorMessage(error))
				} finally {
					setIsSubmitting(false)
				}
			}}
			title="Links"
		>
			<FieldGroup>
				{LINK_FIELDS.map((link) => (
					<Field key={link.field}>
						<FieldLabel htmlFor={`plugin-${link.field}`}>
							{link.label}
						</FieldLabel>
						{'description' in link ? (
							<FieldDescription>
								{link.description}
							</FieldDescription>
						) : null}
						<Input
							disabled={isSubmitting}
							id={`plugin-${link.field}`}
							onChange={(event) =>
								setLinks((current) => ({
									...current,
									[link.field]: event.target.value,
								}))
							}
							placeholder={link.placeholder}
							type="url"
							value={links[link.field]}
						/>
					</Field>
				))}
			</FieldGroup>
		</SettingsSection>
	)
}
