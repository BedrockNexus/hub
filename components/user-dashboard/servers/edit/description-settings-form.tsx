'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Controller, type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { RichTextEditor } from '@/components/editor/rich-text-editor'
import { Button } from '@/components/ui/button'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	SERVER_FORM_DEFAULTS,
	type ServerFormData,
	serverFormSchema,
} from '@/lib/schemas/server'

const descriptionSchema = serverFormSchema.pick({ description: true })

interface ServerDescriptionSettingsFormProps {
	slug: string
	mode?: 'user' | 'admin'
}

export function ServerDescriptionSettingsForm({
	slug,
	mode = 'user',
}: ServerDescriptionSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	const server = useQuery(
		api.functions.servers.servers.getBySlug,
		slug ? { slug } : 'skip',
	)
	const updateUserServer = useMutation(api.functions.servers.servers.update)
	const updateAdminServer = useMutation(
		api.functions.servers.servers.updateAdmin,
	)
	const updateServer = mode === 'admin' ? updateAdminServer : updateUserServer

	const form = useForm<ServerFormData>({
		resolver: zodResolver(
			descriptionSchema,
		) as unknown as Resolver<ServerFormData>,
		defaultValues: SERVER_FORM_DEFAULTS,
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (server) {
			form.reset({
				...SERVER_FORM_DEFAULTS,
				description: server.description ?? '',
			})
		}
	}, [server, form])

	const onSubmit = async (data: ServerFormData) => {
		if (!server) {
			return
		}

		setIsSubmitting(true)
		try {
			await updateServer({
				id: server._id,
				description: data.description || undefined,
			})
			form.reset(data)
			toast.success('Description saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save description'
			toast.error(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (server === undefined) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-72" />
				<Skeleton className="h-px w-full" />
				<Skeleton className="h-80 w-full" />
			</div>
		)
	}

	if (server === null) {
		return (
			<div className="py-12 text-center">
				<h2 className="font-semibold text-xl">Server not found</h2>
				<p className="mt-2 text-muted-foreground">
					The server you&apos;re looking for doesn&apos;t exist or you
					don&apos;t have access to it.
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
					Description
				</h2>
				<p className="text-muted-foreground text-sm">
					Write the full server description shown on the public page
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<Controller
					control={form.control}
					name="description"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="description">
								Full Description
							</FieldLabel>
							<FieldDescription>
								Detailed description of your server, features,
								rules, and community
							</FieldDescription>
							<div id="description">
								<RichTextEditor
									onChange={field.onChange}
									placeholder="Describe your server in detail..."
									value={field.value}
								/>
							</div>
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
