'use client'

import { GalleryManager } from '@/components/user-dashboard/gallery/gallery-manager'
import { usePluginForEdit } from '@/components/user-dashboard/plugins/edit/plugin-edit-data'
import {
	SettingsSection,
	SettingsSkeleton,
} from '@/components/user-dashboard/settings-section'
import type { Id } from '@/convex/_generated/dataModel'

export function PluginGallerySettingsForm({
	draftId,
}: {
	draftId: Id<'pluginPublishingDrafts'>
}) {
	const plugin = usePluginForEdit(draftId)
	if (plugin === undefined) {
		return <SettingsSkeleton />
	}
	return (
		<SettingsSection
			description="Add screenshots of your plugin to showcase it to users"
			title="Gallery"
		>
			{plugin.draft.projectId ? (
				<GalleryManager entityId={draftId} kind="plugin" />
			) : (
				<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
					Pick a build workflow first; then you can add gallery
					images.
				</p>
			)}
		</SettingsSection>
	)
}
