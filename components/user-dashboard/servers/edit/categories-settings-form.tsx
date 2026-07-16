'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
	createCategoryToggler,
	ServerCategoryPicker,
} from '@/components/user-dashboard/servers/fields/server-category-picker'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { SERVER_FORM_DEFAULTS, type ServerFormData } from '@/lib/schemas/server'

const categoriesSchema = z.object({
	categoryIds: z
		.array(z.string())
		.min(1, 'Please select at least one category'),
})

interface CategoriesSettingsFormProps {
	slug: string
	mode?: 'user' | 'admin'
}

export function CategoriesSettingsForm({
	slug,
	mode = 'user',
}: CategoriesSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	const server = useQuery(
		api.functions.servers.servers.getBySlug,
		slug ? { slug } : 'skip',
	)
	const categories = useQuery(api.functions.servers.categories.list, {})
	const updateUserServer = useMutation(api.functions.servers.servers.update)
	const updateAdminServer = useMutation(
		api.functions.servers.servers.updateAdmin,
	)
	const updateServer = mode === 'admin' ? updateAdminServer : updateUserServer

	const form = useForm<ServerFormData>({
		resolver: zodResolver(
			categoriesSchema,
		) as unknown as Resolver<ServerFormData>,
		defaultValues: SERVER_FORM_DEFAULTS,
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	useEffect(() => {
		if (server) {
			form.reset({
				...SERVER_FORM_DEFAULTS,
				categoryIds: server.categoryIds.map(String),
			})
		}
	}, [server, form])

	const toggleCategory = createCategoryToggler(
		() => form.getValues('categoryIds'),
		form.setValue,
	)

	const onSubmit = async (data: ServerFormData) => {
		if (!server) {
			return
		}

		setIsSubmitting(true)
		try {
			await updateServer({
				id: server._id,
				categoryIds: data.categoryIds as Id<'serverCategories'>[],
			})
			form.reset({
				...SERVER_FORM_DEFAULTS,
				categoryIds: data.categoryIds,
			})
			toast.success('Categories saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save categories'
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
				<div className="flex flex-wrap gap-2">
					{(
						[
							'skel-1',
							'skel-2',
							'skel-3',
							'skel-4',
							'skel-5',
							'skel-6',
						] as const
					).map((k) => (
						<Skeleton className="h-8 w-20 rounded-full" key={k} />
					))}
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
					Categories
				</h2>
				<p className="text-muted-foreground text-sm">
					Select categories that describe your server
				</p>
			</div>
			<Separator />
			<ServerCategoryPicker
				categories={categories}
				control={form.control}
				onToggle={toggleCategory}
				watch={form.watch}
			/>
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
