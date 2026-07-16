'use client'

import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import { uploadFileToPresignedUrl } from '@/lib/r2-upload'

export function ExtendedProfileForm() {
	const profile = useQuery(api.functions.site.users.getMyProfile, {})
	const updateProfile = useMutation(api.functions.site.users.updateProfile)
	const generateUploadUrl = useMutation(
		api.functions.site.users.generateProfileBannerUploadUrl,
	)
	const syncMetadata = useMutation(api.lib.r2.syncMetadata)
	const [pending, setPending] = useState(false)
	const [bannerKey, setBannerKey] = useState<string | undefined>()
	const [bannerPreview, setBannerPreview] = useState<string | undefined>()

	if (profile === undefined || profile === null) {
		return <Skeleton className="h-[32rem] w-full rounded-lg" />
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
			const target = await generateUploadUrl({ fileName: file.name })
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
			const get = (name: string) => String(data.get(name) ?? '')
			await updateProfile({
				displayName: get('displayName'),
				bio: get('bio'),
				location: get('location'),
				website: get('website'),
				minecraftUsername: get('minecraftUsername'),
				bannerR2Key: bannerKey,
				socials: {
					discord: get('discord') || undefined,
					youtube: get('youtube') || undefined,
					twitch: get('twitch') || undefined,
					github: get('github') || undefined,
					twitter: get('twitter') || undefined,
				},
			})
			setBannerKey(undefined)
			toast.success('Public profile updated')
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
				<CardTitle>Public Creator Profile</CardTitle>
			</CardHeader>
			<CardContent>
				<form className="space-y-5" onSubmit={handleSubmit}>
					<Field>
						<FieldLabel htmlFor="profile-banner">
							Profile banner
						</FieldLabel>
						{imageUrl ? (
							<div className="relative aspect-[3/1] overflow-hidden rounded-md border">
								<Image
									alt="Profile banner preview"
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
							id="profile-banner"
							onChange={(event) =>
								handleBanner(event.target.files?.[0])
							}
							type="file"
						/>
						<FieldDescription>
							Used on your public creator page.
						</FieldDescription>
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="display-name">
								Display name
							</FieldLabel>
							<Input
								defaultValue={profile.displayName}
								id="display-name"
								maxLength={80}
								name="displayName"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="minecraft-username">
								Minecraft username
							</FieldLabel>
							<Input
								defaultValue={profile.minecraftUsername}
								id="minecraft-username"
								maxLength={32}
								name="minecraftUsername"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="profile-location">
								Location
							</FieldLabel>
							<Input
								defaultValue={profile.location}
								id="profile-location"
								maxLength={80}
								name="location"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="profile-website">
								Website
							</FieldLabel>
							<Input
								defaultValue={profile.website}
								id="profile-website"
								name="website"
								type="url"
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
						<Textarea
							defaultValue={profile.bio}
							id="profile-bio"
							maxLength={1000}
							name="bio"
							rows={6}
						/>
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						{(
							[
								'discord',
								'youtube',
								'twitch',
								'github',
								'twitter',
							] as const
						).map((social) => (
							<Field key={social}>
								<FieldLabel
									className="capitalize"
									htmlFor={`profile-${social}`}
								>
									{social}
								</FieldLabel>
								<Input
									defaultValue={profile.socials[social] ?? ''}
									id={`profile-${social}`}
									name={social}
									placeholder="https://..."
								/>
							</Field>
						))}
					</div>
					<Button disabled={pending} size="sm" type="submit">
						{pending ? <Spinner /> : null}Save Public Profile
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
