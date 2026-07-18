'use client'

import { type Control, Controller } from 'react-hook-form'
import { RichTextEditor } from '@/components/editor/rich-text-editor'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OrgSelector } from '@/components/user-dashboard/org-selector'
import { PROJECT_TYPE_LABELS, PROJECT_TYPES } from '@/lib/project-artifacts'
import type { ProjectFormData } from '@/lib/schemas/projects'

interface ProjectBasicFieldsProps {
	control: Control<ProjectFormData>
	showDescription?: boolean
}

export function ProjectBasicFields({
	control,
	showDescription = true,
}: ProjectBasicFieldsProps) {
	return (
		<>
			<Controller
				control={control}
				name="organizationId"
				render={({ field }) => (
					<Field>
						<FieldLabel htmlFor="organizationId">Owner</FieldLabel>
						<FieldDescription>
							Choose whether this project belongs to you
							personally or to an organization
						</FieldDescription>
						<OrgSelector
							onChange={field.onChange}
							value={field.value}
						/>
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="type"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="type">Project Type *</FieldLabel>
						<FieldDescription>
							What type of project is this?
						</FieldDescription>
						<Select
							onValueChange={field.onChange}
							value={field.value}
						>
							<SelectTrigger id="type">
								<SelectValue>
									{field.value
										? PROJECT_TYPE_LABELS[field.value]
										: 'Select a project type'}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{PROJECT_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{PROJECT_TYPE_LABELS[type]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="name"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="name">Project Name *</FieldLabel>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="name"
							placeholder="My Awesome Project"
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
							A brief tagline for your project (max 150
							characters)
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
								Detailed description of your project (min 50
								characters)
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
			) : null}
		</>
	)
}
