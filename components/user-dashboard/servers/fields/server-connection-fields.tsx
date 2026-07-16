'use client'

import { type Control, Controller } from 'react-hook-form'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ServerFormData } from '@/lib/schemas/server'

interface ServerConnectionFieldsProps {
	control: Control<ServerFormData>
}

export function ServerConnectionFields({
	control,
}: ServerConnectionFieldsProps) {
	return (
		<>
			<Controller
				control={control}
				name="ipAddress"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="ipAddress">
							Server Address *
						</FieldLabel>
						<FieldDescription>
							Domain name or IP address players use to connect
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="ipAddress"
							placeholder="play.myserver.com"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="port"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="port">Port *</FieldLabel>
						<FieldDescription>
							Default Bedrock port is 19132
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="port"
							onChange={(event) =>
								field.onChange(
									event.target.value === ''
										? ''
										: event.target.valueAsNumber,
								)
							}
							placeholder="19132"
							type="number"
							value={field.value ?? ''}
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
