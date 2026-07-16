'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ServerConnectionFields } from '@/components/user-dashboard/servers/fields/server-connection-fields'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	DOMAIN_OR_IP_REGEX,
	SERVER_FORM_DEFAULTS,
	type ServerFormData,
} from '@/lib/schemas/server'

const connectionSchema = z.object({
	ipAddress: z
		.string()
		.min(1, 'IP address is required')
		.regex(DOMAIN_OR_IP_REGEX, 'Please enter a valid domain or IP address'),
	port: z.coerce
		.number()
		.int()
		.min(1, 'Port must be at least 1')
		.max(65_535, 'Port must be less than 65535'),
})

interface ConnectionSettingsFormProps {
	slug: string
	mode?: 'user' | 'admin'
}

export function ConnectionSettingsForm({
	slug,
	mode = 'user',
}: ConnectionSettingsFormProps) {
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
			connectionSchema,
		) as unknown as Resolver<ServerFormData>,
		defaultValues: SERVER_FORM_DEFAULTS,
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (server) {
			form.reset({
				...SERVER_FORM_DEFAULTS,
				ipAddress: server.ipAddress,
				port: server.port,
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
				ipAddress: data.ipAddress,
				port: Number(data.port),
			})
			form.reset(data)
			toast.success('Connection settings saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save settings'
			toast.error(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (server === undefined) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-64" />
				<Skeleton className="h-px w-full" />
				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
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
					Connection Details
				</h2>
				<p className="text-muted-foreground text-sm">
					How players connect to your server
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<ServerConnectionFields control={form.control} />
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
