'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { LicenseCombobox } from '@/components/user-dashboard/license-combobox'
import { SaveBar } from '@/components/user-dashboard/save-bar'
import { SettingsPageHeader } from '@/components/user-dashboard/settings-card'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { LICENSE_CATALOG_SOURCE } from '@/lib/licenses'
import { userFacingError } from '@/lib/user-facing-error'

const licenseSchema = z.object({
	license: z.string().max(80, 'License must be less than 80 characters'),
})

type LicenseFormData = z.infer<typeof licenseSchema>

interface ProjectLicenseSettingsFormProps {
	id: string
}

export function ProjectLicenseSettingsForm({
	id,
}: ProjectLicenseSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const project = useQuery(
		api.functions.projects.projects.getForEdit,
		id ? { id } : 'skip',
	)
	const updateProject = useMutation(api.functions.projects.projects.update)

	const form = useForm<LicenseFormData>({
		resolver: zodResolver(licenseSchema),
		defaultValues: { license: '' },
		mode: 'onChange',
	})
	// Subscribe before conditional rendering or short-circuiting the save state.
	const { isDirty, isValid } = form.formState
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	useEffect(() => {
		if (project) {
			form.reset(
				{
					license: project.license || '',
				},
				{ keepDirtyValues: true },
			)
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
				license: data.license,
			})
			form.reset(data)
			toast.success('License saved!')
		} catch (error) {
			const message = userFacingError(error, 'Failed to save license')
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

	const isSaveDisabled = isSubmitting || !isDirty || !isValid

	return (
		<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
			<SettingsPageHeader
				description="Set the license shown on your public listing."
				title="License"
			/>
			<FieldGroup>
				<Controller
					control={form.control}
					name="license"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="license">License</FieldLabel>
							<FieldDescription>
								Search licenses from{' '}
								<a
									className="underline underline-offset-4"
									href={LICENSE_CATALOG_SOURCE}
									rel="noreferrer noopener"
									target="_blank"
								>
									Choose a License
								</a>{' '}
								by name or SPDX identifier
							</FieldDescription>
							<LicenseCombobox
								disabled={isSubmitting}
								id="license"
								inputRef={field.ref}
								invalid={fieldState.invalid}
								name={field.name}
								onBlur={field.onBlur}
								onChange={field.onChange}
								value={field.value}
							/>
							{fieldState.error && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			</FieldGroup>
			<SaveBar
				canSave={!isSaveDisabled}
				dirty={isDirty}
				isSubmitting={isSubmitting}
				onDiscard={() => form.reset()}
			/>
		</form>
	)
}
