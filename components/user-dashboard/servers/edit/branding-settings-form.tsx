'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ServerBrandingFields } from '@/components/user-dashboard/servers/fields/server-branding-fields'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'

interface BrandingSettingsFormProps {
	slug: string
	mode?: 'user' | 'admin'
}

export function BrandingSettingsForm({
	slug,
	mode = 'user',
}: BrandingSettingsFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [pendingLogoR2Key, setPendingLogoR2Key] = useState<
		string | undefined
	>()
	const [pendingBannerR2Key, setPendingBannerR2Key] = useState<
		string | undefined
	>()
	const [removeLogo, setRemoveLogo] = useState(false)
	const [removeBanner, setRemoveBanner] = useState(false)

	const server = useQuery(
		api.functions.servers.servers.getBySlug,
		slug ? { slug } : 'skip',
	)
	const updateUserServer = useMutation(api.functions.servers.servers.update)
	const updateAdminServer = useMutation(
		api.functions.servers.servers.updateAdmin,
	)
	const updateServer = mode === 'admin' ? updateAdminServer : updateUserServer
	const hasChanges =
		!!pendingLogoR2Key || !!pendingBannerR2Key || removeLogo || removeBanner
	useUnsavedChangesWarning(hasChanges && !isSubmitting)

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!server) {
			return
		}

		setIsSubmitting(true)
		try {
			const logoR2Key: string | null | undefined = removeLogo
				? null
				: pendingLogoR2Key

			const bannerR2Key: string | null | undefined = removeBanner
				? null
				: pendingBannerR2Key

			const updateArgs: {
				id: Id<'servers'>
				logoR2Key?: string | null
				bannerR2Key?: string | null
			} = { id: server._id }

			if (logoR2Key !== undefined) {
				updateArgs.logoR2Key = logoR2Key
			}
			if (bannerR2Key !== undefined) {
				updateArgs.bannerR2Key = bannerR2Key
			}

			await updateServer(updateArgs)

			// Reset pending URLs after successful save
			setPendingLogoR2Key(undefined)
			setPendingBannerR2Key(undefined)
			setRemoveLogo(false)
			setRemoveBanner(false)

			toast.success('Branding saved!')
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to save branding'
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
				<div className="space-y-6">
					<Skeleton className="size-24 rounded-lg" />
					<Skeleton className="h-32 w-full rounded-lg" />
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

	return (
		<form className="space-y-6" onSubmit={onSubmit}>
			<div>
				<h2 className="font-semibold text-lg tracking-tight">
					Branding
				</h2>
				<p className="text-muted-foreground text-sm">
					Upload a logo and banner for your server
				</p>
			</div>
			<Separator />
			<FieldGroup>
				<ServerBrandingFields
					currentBannerUrl={server.bannerUrl}
					currentLogoUrl={server.logoUrl}
					disabled={isSubmitting}
					onBannerUploadComplete={setPendingBannerR2Key}
					onBannerUploadRemoved={() =>
						setPendingBannerR2Key(undefined)
					}
					onLogoUploadComplete={setPendingLogoR2Key}
					onLogoUploadRemoved={() => setPendingLogoR2Key(undefined)}
					onRemoveBanner={() => setRemoveBanner(true)}
					onRemoveLogo={() => setRemoveLogo(true)}
					onUndoRemoveBanner={() => setRemoveBanner(false)}
					onUndoRemoveLogo={() => setRemoveLogo(false)}
					removeBanner={removeBanner}
					removeLogo={removeLogo}
					serverId={server._id}
					serverName={server.name}
				/>
			</FieldGroup>
			<div className="flex justify-end border-t pt-6">
				<Button
					className="w-full sm:w-auto"
					disabled={isSubmitting || !hasChanges}
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
