'use client'

import type { AdditionalFieldValue } from '@better-auth-ui/core'
import { parseAdditionalFieldValue } from '@better-auth-ui/core'
import {
	type UsernameAuthClient,
	useAuth,
	useSession,
	useUpdateUser,
} from '@better-auth-ui/react'
import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { AdditionalField } from '@/components/ba-ui/auth/additional-field'
import { ChangeAvatar } from '@/components/ba-ui/settings/change-avatar'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { SaveBar } from '@/components/user-dashboard/save-bar'
import {
	SettingsCard,
	SettingsPageHeader,
} from '@/components/user-dashboard/settings-card'
import { api } from '@/convex/_generated/api'
import { uploadFileToPresignedUrl } from '@/lib/r2-upload'
import { userFacingError } from '@/lib/user-facing-error'

const SOCIALS = [
	{ key: 'discord', label: 'Discord' },
	{ key: 'youtube', label: 'YouTube' },
	{ key: 'twitch', label: 'Twitch' },
	{ key: 'github', label: 'GitHub' },
	{ key: 'twitter', label: 'X (Twitter)' },
] as const

const BANNER_MAX_BYTES = 8 * 1024 * 1024

/** The public creator profile fields, read from the form. */
function profileFromForm(data: FormData, bannerR2Key: string | undefined) {
	const get = (name: string) => String(data.get(name) ?? '')
	const optional = (name: string) => get(name) || undefined
	return {
		displayName: get('displayName'),
		bio: get('bio'),
		location: get('location'),
		website: get('website'),
		minecraftUsername: get('minecraftUsername'),
		minecraftVersion: get('minecraftVersion'),
		bannerR2Key,
		socials: {
			discord: optional('discord'),
			youtube: optional('youtube'),
			twitch: optional('twitch'),
			github: optional('github'),
			twitter: optional('twitter'),
		},
	}
}

/** The account's display name follows its username. */
function accountUpdate(changes: Record<string, unknown>) {
	return typeof changes.username === 'string'
		? { name: changes.username, ...changes }
		: changes
}

/** Better Auth errors carry their message under `error`. */
function saveErrorMessage(error: unknown) {
	const authMessage = (error as { error?: { message?: string } } | null)
		?.error?.message
	if (authMessage) {
		return authMessage
	}
	if (error instanceof Error && !('data' in error)) {
		// A field's own validation (e.g. an unavailable username).
		return error.message
	}
	return userFacingError(error, 'Could not save your profile')
}

/**
 * One form for everything about you: the account's avatar and username
 * (Better Auth) and the public creator profile (Convex). The avatar saves as
 * soon as it is changed; everything else saves together from the save bar.
 */
export function ProfileSettingsForm() {
	const { additionalFields, authClient } = useAuth()
	const { data: session } = useSession(authClient as UsernameAuthClient)
	const { mutateAsync: updateUser } = useUpdateUser(authClient, {
		// Errors are shown below, once.
		onError: () => undefined,
	})
	const profile = useQuery(api.functions.site.users.getMyProfile, {})
	const activeVersions = useQuery(
		api.functions.site.gameVersions.listActive,
		{},
	)
	// A saved version that is no longer offered stays selectable.
	const gameVersions = [
		...new Set([
			...(activeVersions ?? []).map((item) => item.version),
			...(profile?.minecraftVersion ? [profile.minecraftVersion] : []),
		]),
	].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
	const updateProfile = useMutation(api.functions.site.users.updateProfile)
	const generateUploadUrl = useMutation(
		api.functions.site.users.generateProfileBannerUploadUrl,
	)
	const syncMetadata = useMutation(api.lib.r2.syncMetadata)

	// Changing it re-mounts the fields, which puts back the saved values.
	const [resetKey, setResetKey] = useState(0)
	const [dirty, setDirty] = useState(false)
	const [saving, setSaving] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [bannerKey, setBannerKey] = useState<string | undefined>()
	const [bannerPreview, setBannerPreview] = useState<string | undefined>()

	if (!(profile && session && activeVersions)) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-14 w-72" />
				<Skeleton className="h-80 w-full rounded-lg" />
				<Skeleton className="h-96 w-full rounded-lg" />
			</div>
		)
	}

	const user = session.user as Record<string, unknown>
	const accountFields = (additionalFields ?? []).filter(
		(field) => field.profile !== false,
	)

	const handleBanner = async (file?: File) => {
		if (!file) {
			return
		}
		if (!file.type.startsWith('image/') || file.size > BANNER_MAX_BYTES) {
			toast.error('Choose an image smaller than 8MB')
			return
		}
		setUploading(true)
		try {
			const target = await generateUploadUrl({ fileName: file.name })
			await uploadFileToPresignedUrl({ file, url: target.url })
			await syncMetadata({ key: target.key })
			setBannerKey(target.key)
			setBannerPreview(URL.createObjectURL(file))
			setDirty(true)
		} catch (error) {
			toast.error(userFacingError(error, 'Banner upload failed'))
		} finally {
			setUploading(false)
		}
	}

	/** The account fields that differ from the session, ready to send. */
	const changedAccountFields = async (data: FormData) => {
		const changes: Record<string, unknown> = {}
		for (const field of accountFields) {
			if (field.readOnly) {
				continue
			}
			const value = parseAdditionalFieldValue(
				field,
				data.get(field.name) as string | null,
			)
			if (value === undefined || value === (user[field.name] ?? null)) {
				continue
			}
			await field.validate?.(value)
			changes[field.name] = value
		}
		return changes
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const data = new FormData(event.currentTarget)
		setSaving(true)
		try {
			const accountChanges = await changedAccountFields(data)
			if (Object.keys(accountChanges).length > 0) {
				await updateUser(accountUpdate(accountChanges))
			}
			await updateProfile(profileFromForm(data, bannerKey))
			setBannerKey(undefined)
			setDirty(false)
			toast.success('Profile saved')
		} catch (error) {
			toast.error(saveErrorMessage(error))
		} finally {
			setSaving(false)
		}
	}

	const discard = () => {
		setBannerKey(undefined)
		setBannerPreview(undefined)
		setDirty(false)
		setResetKey((key) => key + 1)
	}

	const bannerUrl = bannerPreview ?? profile.bannerUrl

	return (
		<form
			className="space-y-6"
			key={resetKey}
			noValidate
			onChange={() => setDirty(true)}
			onSubmit={handleSubmit}
		>
			<SettingsPageHeader
				description="How you appear on your creator page and next to everything you publish."
				title="Profile"
			/>

			<SettingsCard title="Basics">
				{/* The avatar saves by itself, so it does not mark the form changed. */}
				<div onChange={(event) => event.stopPropagation()}>
					<ChangeAvatar />
				</div>
				{accountFields.map((field) => {
					const value = user[field.name]
					return (
						<AdditionalField
							field={{
								...field,
								// Seed from the session; `defaultValue` is for sign-up.
								defaultValue:
									value as AdditionalFieldValue | null,
							}}
							isPending={saving}
							key={field.name}
							name={field.name}
						/>
					)
				})}
				<div className="grid gap-5 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="display-name">
							Display name
						</FieldLabel>
						<Input
							defaultValue={profile.displayName}
							disabled={saving}
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
							disabled={saving}
							id="minecraft-username"
							maxLength={32}
							name="minecraftUsername"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="minecraft-version">
							Minecraft version you play
						</FieldLabel>
						<Select
							defaultValue={profile.minecraftVersion ?? null}
							disabled={saving}
							items={[
								{ value: null, label: 'Not set' },
								...gameVersions.map((version) => ({
									value: version,
									label: version,
								})),
							]}
							name="minecraftVersion"
						>
							<SelectTrigger
								className="w-full"
								id="minecraft-version"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={null}>Not set</SelectItem>
								{gameVersions.map((version) => (
									<SelectItem key={version} value={version}>
										{version}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldDescription>
							Private. Marks releases made for your version.
						</FieldDescription>
					</Field>
				</div>
			</SettingsCard>

			<SettingsCard title="About">
				<Field>
					<FieldLabel htmlFor="profile-banner">Banner</FieldLabel>
					{bannerUrl ? (
						<div className="relative aspect-[3/1] overflow-hidden rounded-md border">
							<Image
								alt="Profile banner preview"
								className="object-cover"
								fill
								sizes="(max-width: 768px) 100vw, 720px"
								src={bannerUrl}
							/>
						</div>
					) : null}
					<Input
						accept="image/png,image/jpeg,image/webp,image/gif"
						disabled={saving || uploading}
						id="profile-banner"
						onChange={(event) =>
							handleBanner(event.target.files?.[0])
						}
						type="file"
					/>
					<FieldDescription>
						Shown across the top of your creator page. Up to 8MB.
					</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
					<Textarea
						defaultValue={profile.bio}
						disabled={saving}
						id="profile-bio"
						maxLength={1000}
						name="bio"
						rows={5}
					/>
				</Field>
				<div className="grid gap-5 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="profile-location">
							Location
						</FieldLabel>
						<Input
							defaultValue={profile.location}
							disabled={saving}
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
							disabled={saving}
							id="profile-website"
							name="website"
							placeholder="https://"
							type="url"
						/>
					</Field>
				</div>
			</SettingsCard>

			<SettingsCard title="Social links">
				<div className="grid gap-5 sm:grid-cols-2">
					{SOCIALS.map((social) => (
						<Field key={social.key}>
							<FieldLabel htmlFor={`profile-${social.key}`}>
								{social.label}
							</FieldLabel>
							<Input
								defaultValue={profile.socials[social.key] ?? ''}
								disabled={saving}
								id={`profile-${social.key}`}
								name={social.key}
								placeholder="https://"
							/>
						</Field>
					))}
				</div>
			</SettingsCard>

			<SaveBar
				canSave={!uploading}
				dirty={dirty}
				isSubmitting={saving}
				onDiscard={discard}
			/>
		</form>
	)
}
