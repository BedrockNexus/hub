'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { RichTextEditor } from '@/components/editor/rich-text-editor'
import { Button } from '@/components/ui/button'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { projectFormSchema } from '@/lib/schemas/projects'

const descriptionSchema = projectFormSchema.pick({ description: true })

interface DescriptionFormData {
	description: string
}

interface ProjectDescriptionSettingsFormProps {
	slug: string
}

export function ProjectDescriptionSettingsForm({
	slug,
}: ProjectDescriptionSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const project = useQuery(
		api.functions.projects.projects.getBySlug,
		slug ? { slug } : 'skip',
	)
	const updateProject = useMutation(api.functions.projects.projects.update)

	const form = useForm<DescriptionFormData>({
		resolver: zodResolver(descriptionSchema),
		defaultValues: { description: '' },
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (project) {
			form.reset({ description: project.description })
		}
	}, [project, form])

	const onSubmit = async (data: DescriptionFormData) => {
		if (!project) {
			return
		}

		setIsSubmitting(true)
		try {
			await updateProject({
				id: project._id,
				description: data.description,
			})
			form.reset(data)
			toast.success('Description saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save description'
			toast.error(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (project === undefined) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-72" />
				<Skeleton className="h-px w-full" />
				<Skeleton className="h-80 w-full" />
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
		isSubmitting || !form.formState.isDirty || !form.formState.isValid

	return (
		<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
			<div>
				<h2 className="font-semibold text-lg tracking-tight">
					Description
				</h2>
				<p className="text-muted-foreground text-sm">
					Write the full project description shown on the public page
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<Controller
					control={form.control}
					name="description"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="description">
								Full Description
							</FieldLabel>
							<FieldDescription>
								Detailed description of your project, features,
								setup, and usage
							</FieldDescription>
							<div id="description">
								<RichTextEditor
									onChange={field.onChange}
									placeholder="Describe your project in detail..."
									value={field.value}
								/>
							</div>
							{fieldState.error && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
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
