'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
	createProjectCategoryToggler,
	ProjectCategoryPicker,
} from '@/components/user-dashboard/projects/fields/project-category-picker'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'

const categoriesSchema = z.object({
	categoryIds: z
		.array(z.string())
		.min(1, 'Please select at least one category'),
})

type CategoriesFormData = z.infer<typeof categoriesSchema>

interface ProjectCategoriesSettingsFormProps {
	slug: string
}

export function ProjectCategoriesSettingsForm({
	slug,
}: ProjectCategoriesSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	const project = useQuery(
		api.functions.projects.projects.getBySlug,
		slug ? { slug } : 'skip',
	)
	const categories = useQuery(
		api.functions.projects.categories.list,
		project ? { projectType: project.type } : 'skip',
	)
	const updateProject = useMutation(api.functions.projects.projects.update)

	const form = useForm<CategoriesFormData>({
		resolver: zodResolver(categoriesSchema),
		defaultValues: {
			categoryIds: [],
		},
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (project) {
			form.reset({
				categoryIds: project.categoryIds.map(String),
			})
		}
	}, [project, form])

	const toggleCategory = createProjectCategoryToggler(
		() => form.getValues('categoryIds'),
		(name, value, options) => form.setValue(name, value, options),
	)

	const onSubmit = async (data: CategoriesFormData) => {
		if (!project) {
			return
		}

		setIsSubmitting(true)
		try {
			await updateProject({
				id: project._id,
				categoryIds: data.categoryIds as Id<'projectCategories'>[],
			})
			form.reset(data)
			toast.success('Categories saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save categories'
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
				<div className="flex flex-wrap gap-2">
					{(
						[
							'skel-1',
							'skel-2',
							'skel-3',
							'skel-4',
							'skel-5',
							'skel-6',
						] as const
					).map((k) => (
						<Skeleton className="h-8 w-20 rounded-full" key={k} />
					))}
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
		isSubmitting || !form.formState.isDirty || !form.formState.isValid

	return (
		<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
			<div>
				<h2 className="font-semibold text-lg tracking-tight">
					Categories
				</h2>
				<p className="text-muted-foreground text-sm">
					Select categories that best describe your project
				</p>
			</div>
			<Separator />
			<ProjectCategoryPicker
				categories={categories}
				control={form.control as never}
				onToggle={toggleCategory}
				watch={form.watch as never}
			/>
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
