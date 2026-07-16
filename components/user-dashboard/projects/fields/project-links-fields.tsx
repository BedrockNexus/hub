'use client'

import { type Control, Controller } from 'react-hook-form'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ProjectFormData } from '@/lib/schemas/projects'

interface ProjectLinksFieldsProps {
	control: Control<ProjectFormData>
}

export function ProjectLinksFields({ control }: ProjectLinksFieldsProps) {
	return (
		<>
			<Controller
				control={control}
				name="sourceUrl"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="sourceUrl">
							Source Code URL
						</FieldLabel>
						<FieldDescription>
							Link to the source code repository (e.g. GitHub)
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="sourceUrl"
							placeholder="https://github.com/username/project"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="websiteUrl"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="websiteUrl">
							Website URL
						</FieldLabel>
						<FieldDescription>
							Link to a website or documentation page
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="websiteUrl"
							placeholder="https://my-project.com"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="issueTrackerUrl"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="issueTrackerUrl">
							Issue Tracker URL
						</FieldLabel>
						<FieldDescription>
							Link to bug reports, feature requests, or support
							issues
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="issueTrackerUrl"
							placeholder="https://github.com/username/project/issues"
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
						<FieldLabel htmlFor="wikiUrl">Wiki URL</FieldLabel>
						<FieldDescription>
							Link to documentation, guides, or setup instructions
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="wikiUrl"
							placeholder="https://github.com/username/project/wiki"
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
							Community or support Discord for this project
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="discordUrl"
							placeholder="https://discord.gg/yourproject"
						/>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="donationUrl"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="donationUrl">
							Donation Link
						</FieldLabel>
						<FieldDescription>
							Optional support, sponsor, or donation page
						</FieldDescription>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							id="donationUrl"
							placeholder="https://ko-fi.com/yourproject"
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
