'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'

const licenseSchema = z.object({
	license: z.string().max(80, 'License must be less than 80 characters'),
	licenseCustom: z
		.string()
		.max(2000, 'Custom license text must be less than 2000 characters'),
})

type LicenseFormData = z.infer<typeof licenseSchema>

interface ProjectLicenseSettingsFormProps {
	slug: string
}

export function ProjectLicenseSettingsForm({
	slug,
}: ProjectLicenseSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const project = useQuery(
		api.functions.projects.projects.getBySlug,
		slug ? { slug } : 'skip',
	)
	const updateProject = useMutation(api.functions.projects.projects.update)

	const form = useForm<LicenseFormData>({
		resolver: zodResolver(licenseSchema),
		defaultValues: { license: '', licenseCustom: '' },
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (project) {
			form.reset({
				license: project.license || '',
				licenseCustom: project.licenseCustom || '',
			})
		}
	}, [project, form])

	const onSubmit = async (data: LicenseFormData) => {
		if (!project) {
			return
		}

		setIsSubmitting(true)
		try {
			await updateProject({
				id: project._id,
				license: data.license || undefined,
				licenseCustom: data.licenseCustom || undefined,
			})
			form.reset(data)
			toast.success('License saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save license'
			toast.error(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (project === undefined) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-6 w-40" />
				<Skeleton className="h-4 w-64" />
				<Skeleton className="h-px w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-32 w-full" />
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
					License
				</h2>
				<p className="text-muted-foreground text-sm">
					Set the license shown on the public project details
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<Controller
					control={form.control}
					name="license"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="license">License</FieldLabel>
							<FieldDescription>
								SPDX identifier or short license name
							</FieldDescription>
							<Input
								{...field}
								aria-invalid={fieldState.invalid}
								id="license"
								placeholder="MIT, GPL-3.0, All Rights Reserved"
							/>
							{fieldState.error && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>

				<Controller
					control={form.control}
					name="licenseCustom"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="licenseCustom">
								Custom License Notes
							</FieldLabel>
							<FieldDescription>
								Optional terms or attribution notes for custom
								licenses
							</FieldDescription>
							<Textarea
								{...field}
								aria-invalid={fieldState.invalid}
								className="min-h-32"
								id="licenseCustom"
								placeholder="Add custom license terms or credits..."
							/>
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
