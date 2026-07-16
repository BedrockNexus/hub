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

interface ServerLinksFieldsProps {
	control: Control<ServerFormData>
}

export function ServerLinksFields({ control }: ServerLinksFieldsProps) {
	return (
		<>
			<Controller
				control={control}
				name="website"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="website">Website</FieldLabel>
						<FieldDescription>
							Main website or landing page for this server
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="website"
							placeholder="https://myserver.com"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="discordUrl"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="discordUrl">
							Discord Invite
						</FieldLabel>
						<FieldDescription>
							Community or support Discord invite link
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="discordUrl"
							placeholder="https://discord.gg/yourserver"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="storeUrl"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="storeUrl">Store</FieldLabel>
						<FieldDescription>
							Optional store, shop, or donation page
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="storeUrl"
							placeholder="https://store.myserver.com"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="wikiUrl"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="wikiUrl">Wiki</FieldLabel>
						<FieldDescription>
							Rules, guides, or server documentation
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="wikiUrl"
							placeholder="https://wiki.myserver.com"
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
