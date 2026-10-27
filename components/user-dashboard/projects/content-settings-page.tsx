import { notFound, redirect } from 'next/navigation'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'
import { contentEditHref, legacyContentSection } from '@/lib/content-routes'
import { normalizeProjectType, type ProjectType } from '@/lib/project-artifacts'
import { ProjectCategoriesSettingsForm } from './edit/categories-settings-form'
import { ProjectDescriptionSettingsForm } from './edit/description-settings-form'
import { ProjectGallerySettingsForm } from './edit/gallery-settings-form'
import { ProjectGeneralSettingsForm } from './edit/general-settings-form'
import { ProjectLicenseSettingsForm } from './edit/license-settings-form'
import { ProjectLinksSettingsForm } from './edit/links-settings-form'
import { ProjectVersionsForm } from './edit/versions-settings-form'
import { ProjectSubmissionReview } from './submission-review'
import { AddVersionForm } from './versions/add-version-form'

export interface ContentSettingsProps {
	params: Promise<{ id: string; section?: string[] }>
}
export async function ContentSettingsPage({
	params,
	type,
}: ContentSettingsProps & { type: ProjectType }) {
	const { id, section } = await params
	const item = await fetchAuthQuery(
		api.functions.projects.projects.getForEdit,
		{ id },
	)
	if (!item || normalizeProjectType(item.type) !== type) {
		notFound()
	}
	// Normalize old slug-based edit links, after checking ownership and type.
	if (id !== item._id || section?.[0] === 'edit') {
		redirect(
			contentEditHref(type, item._id) +
				legacyContentSection(section, true),
		)
	}
	const path = section?.join('/') ?? ''
	switch (path) {
		case '':
			return <ProjectGeneralSettingsForm id={item._id} />
		case 'description':
			return <ProjectDescriptionSettingsForm id={item._id} />
		case 'categories':
			return <ProjectCategoriesSettingsForm id={item._id} />
		case 'links':
			return <ProjectLinksSettingsForm id={item._id} />
		case 'license':
			return <ProjectLicenseSettingsForm id={item._id} />
		case 'gallery':
			return <ProjectGallerySettingsForm id={item._id} />
		case 'versions':
			return (
				<ProjectVersionsForm projectId={item._id} projectType={type} />
			)
		case 'review':
			return <ProjectSubmissionReview id={item._id} />
		case 'versions/add':
			return (
				<div className="space-y-6">
					<div>
						<h2 className="font-semibold text-lg">
							Publish New Release
						</h2>
						<p className="text-muted-foreground text-sm">
							Upload a new release for {item.name}
						</p>
					</div>
					<AddVersionForm projectId={item._id} projectType={type} />
				</div>
			)
		default:
			notFound()
	}
}
