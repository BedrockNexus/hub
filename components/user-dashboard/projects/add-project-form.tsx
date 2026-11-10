'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from 'convex/react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
	CreateListingFooter,
	CreateListingShell,
} from '@/components/user-dashboard/create/create-listing-shell'
import { OwnerField } from '@/components/user-dashboard/fields/owner-field'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { contentEditHref } from '@/lib/content-routes'
import { PROJECT_TYPE_LABELS, type ProjectType } from '@/lib/project-artifacts'
import {
	PROJECT_FORM_DEFAULTS,
	projectFormSchema,
	projectMetadataFromForm,
} from '@/lib/schemas/projects'
import { userFacingError } from '@/lib/user-facing-error'

const createSchema = projectFormSchema.pick({
	organizationId: true,
	name: true,
	summary: true,
})

interface CreateFormData {
	organizationId?: string
	name: string
	summary: string
}

const SUMMARY_MAX = 150

const PLACEHOLDERS: Record<ProjectType, { name: string; summary: string }> = {
	addon: {
		name: 'Better Furniture',
		summary: 'Adds 40 craftable chairs, tables and lamps.',
	},
	resource_pack: {
		name: 'Soft Pastel 16x',
		summary: 'A calm pastel take on the default textures.',
	},
}

const LIST_HREF: Record<ProjectType, Route> = {
	addon: '/dashboard/addons',
	resource_pack: '/dashboard/resource-packs',
}

/**
 * Creates an addon or resource pack draft from a name and a summary. The
 * description, categories, images and files are added from its dashboard,
 * where a checklist shows what is left before it can be submitted.
 */
export function AddProjectForm({
	type,
	showPlugins,
}: {
	type: ProjectType
	showPlugins: boolean
}) {
	const label = PROJECT_TYPE_LABELS[type]
	const router = useRouter()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const createContent = useMutation(api.functions.projects.projects.create)

	const form = useForm<CreateFormData>({
		resolver: zodResolver(createSchema),
		defaultValues: { organizationId: undefined, name: '', summary: '' },
		mode: 'onTouched',
	})
	const summary = useWatch({ control: form.control, name: 'summary' })
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	const onSubmit = async (data: CreateFormData) => {
		setIsSubmitting(true)
		try {
			const project = await createContent({
				type,
				name: data.name.trim(),
				summary: data.summary.trim(),
				// The pack details start from the usual defaults.
				metadata: projectMetadataFromForm({
					...PROJECT_FORM_DEFAULTS,
					type,
				}),
				ownerType: data.organizationId ? 'organization' : 'user',
				// Ignored for listings you own yourself.
				ownerId: data.organizationId ?? '__self__',
			})
			// The draft exists now; leaving is no longer losing anything.
			form.reset(data)
			toast.success(`${label} draft created`)
			router.push(contentEditHref(type, project.id, project.publicId))
		} catch (error) {
			toast.error(
				userFacingError(
					error,
					`Failed to create ${label.toLowerCase()}`,
				),
			)
			setIsSubmitting(false)
		}
	}

	return (
		<CreateListingShell kind={type} showPlugins={showPlugins}>
			<form
				className="flex flex-col gap-9"
				noValidate
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<FieldGroup className="gap-5">
					<Controller
						control={form.control}
						name="organizationId"
						render={({ field }) => (
							<OwnerField
								onChange={field.onChange}
								value={field.value}
							/>
						)}
					/>
					<Controller
						control={form.control}
						name="name"
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor="name">Name</FieldLabel>
								<Input
									{...field}
									aria-invalid={fieldState.invalid}
									autoComplete="off"
									className="h-11"
									disabled={isSubmitting}
									id="name"
									placeholder={PLACEHOLDERS[type].name}
								/>
								<FieldError errors={[fieldState.error]} />
							</Field>
						)}
					/>
					<Controller
						control={form.control}
						name="summary"
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<div className="flex items-baseline justify-between gap-3">
									<FieldLabel htmlFor="summary">
										One-line summary
									</FieldLabel>
									<span
										aria-hidden
										className="text-muted-foreground text-xs tabular-nums"
									>
										{summary.length} / {SUMMARY_MAX}
									</span>
								</div>
								<Textarea
									{...field}
									aria-invalid={fieldState.invalid}
									className="min-h-22 resize-none"
									disabled={isSubmitting}
									id="summary"
									maxLength={SUMMARY_MAX}
									placeholder={PLACEHOLDERS[type].summary}
									rows={3}
								/>
								<FieldError errors={[fieldState.error]} />
							</Field>
						)}
					/>
				</FieldGroup>

				<CreateListingFooter note="Next: description, categories, images and your first file.">
					<Link
						className={buttonVariants({ variant: 'ghost' })}
						href={LIST_HREF[type]}
					>
						Cancel
					</Link>
					<Button disabled={isSubmitting} type="submit">
						{isSubmitting ? (
							<>
								<Spinner className="size-4" />
								Creating...
							</>
						) : (
							'Create draft'
						)}
					</Button>
				</CreateListingFooter>
			</form>
		</CreateListingShell>
	)
}
