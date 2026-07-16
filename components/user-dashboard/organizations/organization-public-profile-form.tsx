'use client'

import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import { type FormEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import { uploadFileToPresignedUrl } from '@/lib/r2-upload'

export function OrganizationPublicProfileForm({
	organizationId,
}: {
	organizationId: string
}) {
	const profile = useQuery(
		api.functions.site.organizations.getProfileForSettings,
		{ organizationId },
	)
	const updateProfile = useMutation(
		api.functions.site.organizations.updateProfile,
	)
	const generateUploadUrl = useMutation(
		api.functions.site.organizations.generateBannerUploadUrl,
	)
	const syncMetadata = useMutation(api.lib.r2.syncMetadata)
	const formRef = useRef<HTMLFormElement>(null)
	const [pending, setPending] = useState(false)
	const [bannerKey, setBannerKey] = useState<string | undefined>()
	const [bannerPreview, setBannerPreview] = useState<string | undefined>()

	if (profile === undefined) {
		return <Skeleton className="h-96 w-full rounded-lg" />
	}

	const handleBanner = async (file?: File) => {
		if (!file) {
			return
		}
		if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
			toast.error('Choose an image smaller than 8MB')
			return
		}
		setPending(true)
		try {
			const target = await generateUploadUrl({
				organizationId,
				fileName: file.name,
			})
			await uploadFileToPresignedUrl({ file, url: target.url })
			await syncMetadata({ key: target.key })
			setBannerKey(target.key)
			setBannerPreview(URL.createObjectURL(file))
			toast.success('Banner ready to save')
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Banner upload failed',
			)
		} finally {
			setPending(false)
		}
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setPending(true)
		try {
			const data = new FormData(event.currentTarget)
			await updateProfile({
				organizationId,
				about: String(data.get('about') ?? ''),
				website: String(data.get('website') ?? ''),
				discordUrl: String(data.get('discordUrl') ?? ''),
				bannerR2Key: bannerKey,
			})
			setBannerKey(undefined)
			toast.success('Public organization profile updated')
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not update profile',
			)
		} finally {
			setPending(false)
		}
	}

	const imageUrl = bannerPreview ?? profile.bannerUrl

	return (
		<Card>
			<CardHeader>
				<CardTitle>Public Profile</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					className="space-y-5"
					onSubmit={handleSubmit}
					ref={formRef}
				>
					<Field>
						<FieldLabel htmlFor="organization-banner">
							Banner
						</FieldLabel>
						{imageUrl ? (
							<div className="relative aspect-[3/1] overflow-hidden rounded-md border">
								<Image
									alt="Organization banner preview"
									className="object-cover"
									fill
									sizes="(max-width: 768px) 100vw, 720px"
									src={imageUrl}
								/>
							</div>
						) : null}
						<Input
							accept="image/png,image/jpeg,image/webp,image/gif"
							disabled={pending}
							id="organization-banner"
							onChange={(event) =>
								handleBanner(event.target.files?.[0])
							}
							type="file"
						/>
						<FieldDescription>
							Shown at the top of the public organization page.
						</FieldDescription>
						<FieldError />
					</Field>
					<Field>
						<FieldLabel htmlFor="organization-about">
							About
						</FieldLabel>
						<Textarea
							defaultValue={profile.about}
							id="organization-about"
							maxLength={2000}
							name="about"
							placeholder="Tell the community what your team builds."
							rows={6}
						/>
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="organization-website">
								Website
							</FieldLabel>
							<Input
								defaultValue={profile.website}
								id="organization-website"
								name="website"
								placeholder="https://example.com"
								type="url"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="organization-discord">
								Discord
							</FieldLabel>
							<Input
								defaultValue={profile.discordUrl}
								id="organization-discord"
								name="discordUrl"
								placeholder="https://discord.gg/..."
								type="url"
							/>
						</Field>
					</div>
					<Button disabled={pending} size="sm" type="submit">
						{pending ? <Spinner /> : null}
						Save Public Profile
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
