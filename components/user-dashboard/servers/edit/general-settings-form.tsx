'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Controller, type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryMultiSelect } from '@/components/user-dashboard/fields/category-multi-select'
import { NameSummaryFields } from '@/components/user-dashboard/fields/name-summary-fields'
import { SaveBar } from '@/components/user-dashboard/save-bar'
import { ServerMetadataFields } from '@/components/user-dashboard/servers/fields/server-metadata-fields'
import {
	SettingsCard,
	SettingsPageHeader,
} from '@/components/user-dashboard/settings-card'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { SERVER_FORM_DEFAULTS, type ServerFormData } from '@/lib/schemas/server'
import { userFacingError } from '@/lib/user-facing-error'

const generalSchema = z.object({
	organizationId: z.string().optional(),
	name: z
		.string()
		.min(3, 'Server name must be at least 3 characters')
		.max(50, 'Server name must be less than 50 characters'),
	smallDescription: z
		.string()
		.min(10, 'Short description must be at least 10 characters')
		.max(150, 'Short description must be less than 150 characters'),
	region: z.string().optional().or(z.literal('')),
	language: z.array(z.string()),
	gameVersions: z.array(z.string()),
	softwareId: z.string().optional().or(z.literal('')),
	categoryIds: z.array(z.string()),
})

interface GeneralSettingsFormProps {
	id: string
	mode?: 'user' | 'admin'
}

export function GeneralSettingsForm({
	id,
	mode = 'user',
}: GeneralSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	const server = useQuery(
		api.functions.servers.servers.getForEdit,
		id ? { id } : 'skip',
	)
	const categories = useQuery(api.functions.servers.categories.list, {})
	const updateUserServer = useMutation(api.functions.servers.servers.update)
	const updateAdminServer = useMutation(
		api.functions.servers.servers.updateAdmin,
	)

	const form = useForm<ServerFormData>({
		resolver: zodResolver(
			generalSchema,
		) as unknown as Resolver<ServerFormData>,
		defaultValues: SERVER_FORM_DEFAULTS,
		mode: 'onChange',
	})
	// Subscribe before conditional rendering or short-circuiting the save state.
	const { isDirty, isValid } = form.formState
	useUnsavedChangesWarning(isDirty && !isSubmitting)

	useEffect(() => {
		if (server) {
			form.reset(
				{
					...SERVER_FORM_DEFAULTS,
					organizationId:
						server.ownerType === 'organization'
							? server.ownerId
							: undefined,
					name: server.name,
					smallDescription: server.smallDescription,
					region: server.region || '',
					language: server.language ?? [],
					gameVersions: server.gameVersions ?? [],
					softwareId: server.softwareId ?? '',
					categoryIds: server.categoryIds.map(String),
				},
				{ keepDirtyValues: true },
			)
		}
	}, [server, form])

	const onSubmit = async (data: ServerFormData) => {
		if (!server) {
			return
		}

		setIsSubmitting(true)
		try {
			const fields = {
				id: server._id,
				name: data.name,
				smallDescription: data.smallDescription,
				region: data.region || undefined,
				language: data.language,
				gameVersions: data.gameVersions,
				// null clears a previously declared software.
				softwareId: data.softwareId
					? (data.softwareId as Id<'serverSoftware'>)
					: null,
				...(data.categoryIds.length > 0
					? {
							categoryIds:
								data.categoryIds as Id<'serverCategories'>[],
						}
					: {}),
			}
			// Only owners can move a server between accounts; the admin
			// mutation edits listing fields only.
			if (mode === 'admin') {
				await updateAdminServer(fields)
			} else {
				await updateUserServer({
					...fields,
					organizationId: data.organizationId || '',
				})
			}
			form.reset(data)
			toast.success('General settings saved!')
		} catch (error) {
			const message = userFacingError(error, 'Failed to save settings')
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
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-32 w-full" />
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

	// A new draft starts without categories and can be saved without them
	// (the checklist asks for one before submitting). Once a listing has a
	// category it keeps at least one.
	const categoriesCleared =
		server.categoryIds.length > 0 && form.watch('categoryIds').length === 0
	const isSaveDisabled =
		isSubmitting || !isDirty || !isValid || categoriesCleared

	return (
		<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
			<SettingsPageHeader
				description="How your server appears in lists and search."
				title="General"
			/>
			<SettingsCard id="basics" title="Basics">
				<NameSummaryFields
					control={form.control}
					disabled={isSubmitting}
					showOwner={mode === 'user'}
					summaryName="smallDescription"
				/>
			</SettingsCard>
			<SettingsCard id="categories" title="Discovery">
				<Controller
					control={form.control}
					name="categoryIds"
					render={({ field }) => (
						<CategoryMultiSelect
							categories={categories}
							disabled={isSubmitting}
							error={
								categoriesCleared
									? 'Keep at least one category'
									: undefined
							}
							onChange={field.onChange}
							value={field.value}
						/>
					)}
				/>
			</SettingsCard>
			<SettingsCard id="details" title="Server details">
				<ServerMetadataFields
					control={form.control}
					disabled={isSubmitting}
				/>
			</SettingsCard>
			<SaveBar
				canSave={!isSaveDisabled}
				dirty={isDirty}
				isSubmitting={isSubmitting}
				onDiscard={() => form.reset()}
			/>
		</form>
	)
}
