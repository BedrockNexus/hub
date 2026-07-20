'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ProjectBasicFields } from '@/components/user-dashboard/projects/fields/project-basic-fields'
import { ProjectIconField } from '@/components/user-dashboard/projects/fields/project-icon-field'
import { ProjectTypeFields } from '@/components/user-dashboard/projects/fields/project-type-fields'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { normalizeProjectType } from '@/lib/project-artifacts'
import {
	PROJECT_FORM_DEFAULTS,
	type ProjectFormData,
	projectFormSchema,
	projectMetadataFromForm,
	projectMetadataToForm,
} from '@/lib/schemas/projects'

const generalSchema = projectFormSchema.pick({
	organizationId: true,
	type: true,
	name: true,
	summary: true,
	behaviorPackIncluded: true,
	resourcePackIncluded: true,
	experimentalFeaturesRequired: true,
	addonDependencies: true,
	mapGameMode: true,
	mapMultiplayerSupport: true,
	mapEstimatedPlaytimeMinutes: true,
	resourcePackResolution: true,
	resourcePackContentTypes: true,
	skinCharacterCategory: true,
})

interface ProjectGeneralSettingsFormProps {
	slug: string
}

export function ProjectGeneralSettingsForm({
	slug,
}: ProjectGeneralSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [pendingIconR2Key, setPendingIconR2Key] = useState<
		string | undefined
	>()
	const [removeIcon, setRemoveIcon] = useState(false)

	const project = useQuery(
		api.functions.projects.projects.getBySlug,
		slug ? { slug } : 'skip',
	)
	const updateProject = useMutation(api.functions.projects.projects.update)

	const form = useForm<ProjectFormData>({
		resolver: zodResolver(
			generalSchema,
		) as unknown as Resolver<ProjectFormData>,
		defaultValues: PROJECT_FORM_DEFAULTS,
		mode: 'onChange',
	})
	const hasIconChanges = !!pendingIconR2Key || removeIcon
	useUnsavedChangesWarning(
		(form.formState.isDirty || hasIconChanges) && !isSubmitting,
	)

	useEffect(() => {
		if (project) {
			form.reset({
				...PROJECT_FORM_DEFAULTS,
				organizationId:
					project.ownerType === 'organization'
						? project.ownerId
						: undefined,
				type: normalizeProjectType(project.type),
				name: project.name,
				summary: project.summary,
				...projectMetadataToForm(project.metadata),
			})
			setPendingIconR2Key(undefined)
			setRemoveIcon(false)
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
				organizationId: data.organizationId || undefined,
				type: data.type,
				name: data.name,
				summary: data.summary,
				metadata: projectMetadataFromForm(data),
			}

			if (iconR2Key !== undefined) {
				updateArgs.iconR2Key = iconR2Key
			}

			await updateProject({
				...updateArgs,
			})
			form.reset(data)
			setPendingIconR2Key(undefined)
			setRemoveIcon(false)
			toast.success('General settings saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save settings'
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
				<h2 className="font-semibold text-xl">Project not found</h2>
				<p className="mt-2 text-muted-foreground">
					The project you&apos;re looking for doesn&apos;t exist or
					you don&apos;t have access to it.
				</p>
			</div>
		)
	}

	const isSaveDisabled =
		isSubmitting ||
		!(form.formState.isDirty || hasIconChanges) ||
		!form.formState.isValid

	return (
		<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
			<div>
				<h2 className="font-semibold text-lg tracking-tight">
					General Settings
				</h2>
				<p className="text-muted-foreground text-sm">
					Basic information about your project
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<ProjectIconField
					currentIconUrl={project.iconUrl}
					disabled={isSubmitting}
					onIconUploadComplete={setPendingIconR2Key}
					onIconUploadRemoved={() => setPendingIconR2Key(undefined)}
					onRemoveIcon={() => setRemoveIcon(true)}
					onUndoRemoveIcon={() => setRemoveIcon(false)}
					projectId={project._id}
					projectName={form.watch('name') || project.name}
					removeIcon={removeIcon}
				/>
				<ProjectBasicFields
					control={form.control}
					showDescription={false}
				/>
				<ProjectTypeFields form={form} />
			</FieldGroup>
			<div className="flex justify-end border-t pt-6">
				<Button
					className="w-full sm:w-auto"
					disabled={isSaveDisabled}
					type="submit"
				>
					{isSubmitting ? (
						<>
							<Spinner className="size-4" />
							Saving...
						</>
					) : (
						'Save Changes'
					)}
				</Button>
			</div>
		</form>
	)
}
