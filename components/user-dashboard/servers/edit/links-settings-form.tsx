'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ServerLinksFields } from '@/components/user-dashboard/servers/fields/server-links-fields'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	SERVER_FORM_DEFAULTS,
	type ServerFormData,
	serverFormSchema,
} from '@/lib/schemas/server'

const linksSchema = serverFormSchema.pick({
	website: true,
	discordUrl: true,
	storeUrl: true,
	wikiUrl: true,
})

interface LinksSettingsFormProps {
	slug: string
	mode?: 'user' | 'admin'
}

export function LinksSettingsForm({
	slug,
	mode = 'user',
}: LinksSettingsFormProps) {
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
			linksSchema,
		) as unknown as Resolver<ServerFormData>,
		defaultValues: SERVER_FORM_DEFAULTS,
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (server) {
			form.reset({
				...SERVER_FORM_DEFAULTS,
				website: server.website || '',
				discordUrl: server.discordUrl || '',
				storeUrl: server.storeUrl || '',
				wikiUrl: server.wikiUrl || '',
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
				website: data.website || undefined,
				discordUrl: data.discordUrl || undefined,
				storeUrl: data.storeUrl || undefined,
				wikiUrl: data.wikiUrl || undefined,
			})
			form.reset(data)
			toast.success('Links saved!')
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to save links'
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
				<h2 className="font-semibold text-lg tracking-tight">Links</h2>
				<p className="text-muted-foreground text-sm">
					Manage public links for your server
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<ServerLinksFields control={form.control} />
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
