'use client'

import { type Control, Controller } from 'react-hook-form'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { OrgSelector } from '@/components/user-dashboard/org-selector'
import type { ServerFormData } from '@/lib/schemas/server'

interface ServerBasicFieldsProps {
	control: Control<ServerFormData>
}

export function ServerBasicFields({ control }: ServerBasicFieldsProps) {
	return (
		<>
			<Controller
				control={control}
				name="organizationId"
				render={({ field }) => (
					<Field>
						<FieldLabel htmlFor="organizationId">Owner</FieldLabel>
						<FieldDescription>
							Choose whether this server belongs to you personally
							or to an organization
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
				name="name"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="name">Server Name *</FieldLabel>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="name"
							placeholder="My Awesome Server"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="smallDescription"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="smallDescription">
							Short Description *
						</FieldLabel>
						<FieldDescription>
							A brief tagline for your server (max 150 characters)
						</FieldDescription>
						<Textarea
							{...field}
							aria-invalid={fieldState.invalid}
							id="smallDescription"
							placeholder="The best survival server with an amazing community!"
							rows={2}
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>
		</>
	)
}
