'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ProjectLinksFields } from '@/components/user-dashboard/projects/fields/project-links-fields'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'

const linksSchema = z.object({
	sourceUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	websiteUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	issueTrackerUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	wikiUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	discordUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	donationUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
})

type LinksFormData = z.infer<typeof linksSchema>

interface ProjectLinksSettingsFormProps {
	slug: string
}

export function ProjectLinksSettingsForm({
	slug,
}: ProjectLinksSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	const project = useQuery(
		api.functions.projects.projects.getBySlug,
		slug ? { slug } : 'skip',
	)
	const updateProject = useMutation(api.functions.projects.projects.update)

	const form = useForm<LinksFormData>({
		resolver: zodResolver(linksSchema),
		defaultValues: {
			sourceUrl: '',
			websiteUrl: '',
			issueTrackerUrl: '',
			wikiUrl: '',
			discordUrl: '',
			donationUrl: '',
		},
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (project) {
			form.reset({
				sourceUrl: project.sourceUrl || '',
				websiteUrl: project.websiteUrl || '',
				issueTrackerUrl: project.issueTrackerUrl || '',
				wikiUrl: project.wikiUrl || '',
				discordUrl: project.discordUrl || '',
				donationUrl: project.donationUrl || '',
			})
		}
	}, [project, form])

	const onSubmit = async (data: LinksFormData) => {
		if (!project) {
			return
		}

		setIsSubmitting(true)
		try {
			await updateProject({
				id: project._id,
				sourceUrl: data.sourceUrl || undefined,
				websiteUrl: data.websiteUrl || undefined,
				issueTrackerUrl: data.issueTrackerUrl || undefined,
				wikiUrl: data.wikiUrl || undefined,
				discordUrl: data.discordUrl || undefined,
				donationUrl: data.donationUrl || undefined,
			})
			form.reset(data)
			toast.success('Links saved!')
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to save links'
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
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
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
				<h2 className="font-semibold text-lg tracking-tight">Links</h2>
				<p className="text-muted-foreground text-sm">
					Manage resource links for your project
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<ProjectLinksFields control={form.control as never} />
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
