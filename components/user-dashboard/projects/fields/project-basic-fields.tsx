'use client'

import { type Control, Controller } from 'react-hook-form'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { OrgSelector } from '@/components/user-dashboard/org-selector'
import { PROJECT_TYPE_LABELS, type ProjectType } from '@/lib/project-artifacts'
import type { ProjectFormData } from '@/lib/schemas/projects'

interface ProjectBasicFieldsProps {
	contentType: ProjectType
	control: Control<ProjectFormData>
	showDescription?: boolean
}

export function ProjectBasicFields({
	contentType,
	control,
	showDescription = true,
}: ProjectBasicFieldsProps) {
	const label = PROJECT_TYPE_LABELS[contentType]
	return (
		<>
			<Controller
				control={control}
				name="organizationId"
				render={({ field }) => (
					<Field>
						<FieldLabel htmlFor="organizationId">Owner</FieldLabel>
						<FieldDescription>
							Choose whether this {label.toLowerCase()} belongs to
							you personally or to an organization
						</FieldDescription>
						<OrgSelector
							onChange={field.onChange}
							value={field.value ?? ''}
						/>
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="name"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="name">{label} Name *</FieldLabel>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="name"
							placeholder={`My ${label}`}
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="summary"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="summary">Summary *</FieldLabel>
						<FieldDescription>
							A brief tagline for your {label.toLowerCase()} (max
							150 characters)
						</FieldDescription>
						<Textarea
							{...field}
							aria-invalid={fieldState.invalid}
							id="summary"
							placeholder="Adds amazing new blocks and mobs to your world!"
							rows={2}
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			{showDescription ? (
				<Controller
					control={control}
					name="description"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="description">
								Full Description *
							</FieldLabel>
							<FieldDescription>
								Detailed description of your{' '}
								{label.toLowerCase()} (min 50 characters)
							</FieldDescription>
							<div id="description">
								<MarkdownEditor
									allowImageUpload
									onChange={field.onChange}
									placeholder={`Describe your ${label.toLowerCase()} in detail...`}
									value={field.value ?? ''}
								/>
							</div>
							{fieldState.error && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			) : null}
		</>
	)
}
