'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Controller, type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryMultiSelect } from '@/components/user-dashboard/fields/category-multi-select'
import { NameSummaryFields } from '@/components/user-dashboard/fields/name-summary-fields'
import { ProjectIconField } from '@/components/user-dashboard/projects/fields/project-icon-field'
import { ProjectTypeFields } from '@/components/user-dashboard/projects/fields/project-type-fields'
import { SaveBar } from '@/components/user-dashboard/save-bar'
import {
	SettingsCard,
	SettingsPageHeader,
} from '@/components/user-dashboard/settings-card'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
} from '@/lib/project-artifacts'
import {
	PROJECT_FORM_DEFAULTS,
	type ProjectFormData,
	projectFormSchema,
	projectMetadataFromForm,
	projectMetadataToForm,
} from '@/lib/schemas/projects'
import { parseTagInput, TAG_LIMITS, tagsProblem } from '@/lib/tags'
import { userFacingError } from '@/lib/user-facing-error'

const generalSchema = projectFormSchema
	.pick({
		organizationId: true,
		type: true,
		name: true,
		summary: true,
		behaviorPackIncluded: true,
		resourcePackIncluded: true,
		experimentalFeaturesRequired: true,
		addonDependencies: true,
		resourcePackResolution: true,
		resourcePackContentTypes: true,
	})
	.extend({ categoryIds: z.array(z.string()) })

interface ProjectGeneralSettingsFormProps {
	id: string
}

export function ProjectGeneralSettingsForm({
	id,
}: ProjectGeneralSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [pendingIconR2Key, setPendingIconR2Key] = useState<
		string | undefined
	>()
	const [removeIcon, setRemoveIcon] = useState(false)
	// Tags are a comma-separated text field kept outside the form schema,
	// which is shared with the create form (lib/schemas/projects.ts). Null
	// until the creator types, so live refreshes show the saved tags.
	const [editedTags, setEditedTags] = useState<string | null>(null)

	const project = useQuery(
		api.functions.projects.projects.getForEdit,
		id ? { id } : 'skip',
	)
	const categories = useQuery(
		api.functions.projects.categories.list,
		project ? { projectType: project.type } : 'skip',
	)
	const updateProject = useMutation(api.functions.projects.projects.update)

	const form = useForm<ProjectFormData>({
		resolver: zodResolver(
			generalSchema,
		) as unknown as Resolver<ProjectFormData>,
		defaultValues: PROJECT_FORM_DEFAULTS,
		mode: 'onChange',
	})
	// Subscribe before conditional rendering or short-circuiting the save state.
	const { isDirty, isValid } = form.formState
	const hasIconChanges = !!pendingIconR2Key || removeIcon
	const savedTags = (project?.tags ?? []).join(', ')
	const tags = editedTags ?? savedTags
	const tagsDirty = editedTags !== null && editedTags !== savedTags
	const tagsError = tagsProblem(parseTagInput(tags))
	useUnsavedChangesWarning(
		(isDirty || hasIconChanges || tagsDirty) && !isSubmitting,
	)

	useEffect(() => {
		if (project) {
			form.reset(
				{
					...PROJECT_FORM_DEFAULTS,
					organizationId:
						project.ownerType === 'organization'
							? project.ownerId
							: undefined,
					type: normalizeProjectType(project.type),
					name: project.name,
					summary: project.summary,
					categoryIds: project.categoryIds.map(String),
					...projectMetadataToForm(project.metadata),
				},
				// Live query refreshes must not wipe edits the creator has not saved.
				{ keepDirtyValues: true },
			)
		}
	}, [project, form])

	const onSubmit = async (data: ProjectFormData) => {
		if (!project) {
			return
		}

		setIsSubmitting(true)
		try {
			const iconR2Key: string | null | undefined = removeIcon
				? null
				: pendingIconR2Key
			const updateArgs: Parameters<typeof updateProject>[0] = {
				id: project._id,
				organizationId: data.organizationId || '',
				name: data.name,
				summary: data.summary,
				...(data.categoryIds.length > 0
					? {
							categoryIds:
								data.categoryIds as Id<'projectCategories'>[],
						}
					: {}),
				tags: parseTagInput(tags),
				metadata: projectMetadataFromForm(data),
			}

			if (iconR2Key !== undefined) {
				updateArgs.iconR2Key = iconR2Key
			}

			await updateProject({
				...updateArgs,
			})
			form.reset(data)
			// Convex updates the query before the mutation resolves, so the
			// saved (normalized) tags show from here.
			setEditedTags(null)
			setPendingIconR2Key(undefined)
			setRemoveIcon(false)
			toast.success('General settings saved!')
		} catch (error) {
			const message = userFacingError(error, 'Failed to save settings')
			toast.error(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (project === undefined) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-64" />
				<Skeleton className="h-px w-full" />
				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			</div>
		)
	}

	if (project === null) {
		return (
			<div className="py-12 text-center">
				<h2 className="font-semibold text-xl">Listing not found</h2>
				<p className="mt-2 text-muted-foreground">
					The listing you&apos;re looking for doesn&apos;t exist or
					you don&apos;t have access to it.
				</p>
			</div>
		)
	}

	// A new draft starts without categories and can be saved without them
	// (the checklist asks for one before submitting). Once a listing has a
	// category it keeps at least one.
	const categoriesCleared =
		project.categoryIds.length > 0 && form.watch('categoryIds').length === 0
	const isSaveDisabled =
		isSubmitting ||
		!(isDirty || hasIconChanges || tagsDirty) ||
		!isValid ||
		categoriesCleared ||
		Boolean(tagsError)
	const tagPreview = parseTagInput(tags)

	return (
		<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
			<SettingsPageHeader
				description={`How your ${PROJECT_TYPE_LABELS[normalizeProjectType(project.type)].toLowerCase()} appears in lists and search.`}
				title="General"
			/>
			<SettingsCard id="basics" title="Basics">
				<div className="scroll-mt-24" id="icon">
					<ProjectIconField
						currentIconUrl={project.iconUrl}
						disabled={isSubmitting}
						onIconUploadComplete={setPendingIconR2Key}
						onIconUploadRemoved={() =>
							setPendingIconR2Key(undefined)
						}
						onRemoveIcon={() => setRemoveIcon(true)}
						onUndoRemoveIcon={() => setRemoveIcon(false)}
						projectId={project._id}
						projectName={form.watch('name') || project.name}
						removeIcon={removeIcon}
					/>
				</div>
				<NameSummaryFields
					control={form.control}
					disabled={isSubmitting}
					summaryName="summary"
				/>
			</SettingsCard>
			<SettingsCard id="categories" title="Discovery">
				<Controller
					control={form.control}
					name="categoryIds"
					render={({ field }) => (
						<CategoryMultiSelect
							categories={categories}
							disabled={isSubmitting}
							error={
								categoriesCleared
									? 'Keep at least one category'
									: undefined
							}
							onChange={field.onChange}
							value={field.value}
						/>
					)}
				/>
				<Field data-invalid={Boolean(tagsError)}>
					<FieldLabel htmlFor="tags">Search keywords</FieldLabel>
					<Input
						aria-describedby="tags-hint"
						aria-invalid={Boolean(tagsError)}
						disabled={isSubmitting}
						id="tags"
						onChange={(event) => setEditedTags(event.target.value)}
						placeholder="furniture, decoration, survival"
						value={tags}
					/>
					<FieldDescription id="tags-hint">
						Optional. Up to {TAG_LIMITS.maxTags}, separated by
						commas.
					</FieldDescription>
					{tagPreview.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{tagPreview.map((tag) => (
								<Badge key={tag} variant="secondary">
									{tag}
								</Badge>
							))}
						</div>
					) : null}
					{tagsError ? <FieldError>{tagsError}</FieldError> : null}
				</Field>
			</SettingsCard>
			<SettingsCard
				flush={normalizeProjectType(project.type) === 'addon'}
				id="details"
				title={
					normalizeProjectType(project.type) === 'addon'
						? "What's in the download"
						: 'Pack details'
				}
			>
				<ProjectTypeFields form={form} />
			</SettingsCard>
			<SaveBar
				canSave={!isSaveDisabled}
				dirty={isDirty || hasIconChanges || tagsDirty}
				isSubmitting={isSubmitting}
				onDiscard={() => {
					form.reset()
					setEditedTags(null)
					setPendingIconR2Key(undefined)
					setRemoveIcon(false)
				}}
			/>
		</form>
	)
}
