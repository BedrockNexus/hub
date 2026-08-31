'use client'

import {
	Cancel01Icon,
	Settings01Icon,
	Tick02Icon,
	Upload03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import Image from 'next/image'
import type React from 'react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Status, StatusLabel } from '@/components/dice-ui/status'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import { uploadFileToPresignedUrl } from '@/lib/r2-upload'
import { AdminPageHeader } from './admin-page-header'

interface SeoDraft {
	siteDescription: string
}

interface SocialsDraft {
	discord: string
	youtube: string
	instagram: string
	bluesky: string
	tiktok: string
}

interface FeaturesDraft {
	registrationEnabled: boolean
	maintenanceMode: boolean
}

const DEFAULT_SEO_DRAFT: SeoDraft = {
	siteDescription:
		'Discover Minecraft Bedrock servers, projects, and community content.',
}

const DEFAULT_SOCIALS_DRAFT: SocialsDraft = {
	discord: '',
	youtube: '',
	instagram: '',
	bluesky: '',
	tiktok: '',
}

const DEFAULT_FEATURES_DRAFT: FeaturesDraft = {
	registrationEnabled: true,
	maintenanceMode: false,
}
const MAX_SITE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_SITE_IMAGE_TYPES = new Set([
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
])
const SITE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

function optionalString(value: string) {
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}

function AdminSettingsSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-16 w-full max-w-xl rounded-md" />
			<div className="grid gap-4 lg:grid-cols-2">
				<Skeleton className="h-96 rounded-xl" />
				<Skeleton className="h-96 rounded-xl" />
			</div>
		</div>
	)
}

function SettingStatus({ enabled }: { enabled: boolean }) {
	return enabled ? (
		<Status variant="success">
			<StatusLabel>Enabled</StatusLabel>
		</Status>
	) : (
		<Status>
			<StatusLabel>Disabled</StatusLabel>
		</Status>
	)
}

function useSiteImageUpload(label: string) {
	const [file, setFile] = useState<File | null>(null)
	const [preview, setPreview] = useState<string | null>(null)
	const [removed, setRemoved] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		return () => {
			if (preview) {
				URL.revokeObjectURL(preview)
			}
		}
	}, [preview])

	function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
		const nextFile = event.target.files?.[0] ?? null
		if (
			nextFile &&
			(!ALLOWED_SITE_IMAGE_TYPES.has(nextFile.type) ||
				nextFile.size > MAX_SITE_IMAGE_SIZE_BYTES)
		) {
			toast.error(
				`${label} must be a PNG, JPG, WebP, or GIF file no larger than 5MB`,
			)
			event.target.value = ''
			return
		}

		setFile(nextFile)
		setRemoved(false)
		setPreview(nextFile ? URL.createObjectURL(nextFile) : null)
	}

	function remove() {
		setFile(null)
		setPreview(null)
		setRemoved(true)
		if (inputRef.current) {
			inputRef.current.value = ''
		}
	}

	function undoRemove() {
		setRemoved(false)
	}

	function reset() {
		setFile(null)
		setPreview(null)
		setRemoved(false)
		if (inputRef.current) {
			inputRef.current.value = ''
		}
	}

	return {
		file,
		handleFileChange,
		inputRef,
		preview,
		remove,
		removed,
		reset,
		undoRemove,
	}
}

function SiteImageUploadField({
	currentUrl,
	description,
	disabled,
	file,
	handleFileChange,
	inputRef,
	label,
	preview,
	remove,
	removed,
	undoRemove,
}: {
	currentUrl?: string
	description: string
	disabled: boolean
	file: File | null
	handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
	inputRef: React.RefObject<HTMLInputElement | null>
	label: string
	preview: string | null
	remove: () => void
	removed: boolean
	undoRemove: () => void
}) {
	const displayUrl = preview ?? (removed ? undefined : currentUrl)

	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<Label>{label}</Label>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
			{displayUrl && (
				<Image
					alt={`${label} preview`}
					className="aspect-[40/21] w-full max-w-md rounded-md border bg-muted object-contain"
					height={315}
					src={displayUrl}
					unoptimized
					width={600}
				/>
			)}
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={disabled}
					onClick={() => inputRef.current?.click()}
					size="sm"
					type="button"
					variant="outline"
				>
					<HugeiconsIcon className="size-4" icon={Upload03Icon} />
					{file || currentUrl ? 'Change' : 'Upload'}
				</Button>
				{(currentUrl || file) && !removed && (
					<Button
						disabled={disabled}
						onClick={remove}
						size="sm"
						type="button"
						variant="outline"
					>
						<HugeiconsIcon className="size-4" icon={Cancel01Icon} />
						Remove
					</Button>
				)}
				{removed && (
					<Button
						disabled={disabled}
						onClick={undoRemove}
						size="sm"
						type="button"
						variant="outline"
					>
						Undo Remove
					</Button>
				)}
			</div>
			<input
				accept={SITE_IMAGE_ACCEPT}
				className="hidden"
				onChange={handleFileChange}
				ref={inputRef}
				type="file"
			/>
			{file && (
				<p className="truncate text-muted-foreground text-xs">
					{file.name}
				</p>
			)}
		</div>
	)
}

function FeatureToggle({
	checked,
	description,
	disabled,
	id,
	label,
	onChange,
}: {
	checked: boolean
	description: string
	disabled?: boolean
	id: string
	label: string
	onChange: (checked: boolean) => void
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-md border p-4">
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<Label htmlFor={id}>{label}</Label>
					<SettingStatus enabled={checked} />
				</div>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			<Switch
				checked={checked}
				disabled={disabled}
				id={id}
				onCheckedChange={onChange}
			/>
		</div>
	)
}

export function AdminSettingsManager() {
	const settings = useQuery(api.functions.site.settings.getAdmin, {})
	const updateSeo = useMutation(api.functions.site.settings.updateSeo)
	const updateSocials = useMutation(api.functions.site.settings.updateSocials)
	const updateFeatures = useMutation(
		api.functions.site.settings.updateFeatures,
	)
	const generateSiteImageUploadUrl = useMutation(
		api.functions.site.settings.generateSiteImageUploadUrl,
	)
	const syncR2Metadata = useMutation(api.lib.r2.syncMetadata)

	const [seoDraft, setSeoDraft] = useState<SeoDraft>(DEFAULT_SEO_DRAFT)
	const [socialsDraft, setSocialsDraft] = useState<SocialsDraft>(
		DEFAULT_SOCIALS_DRAFT,
	)
	const [featuresDraft, setFeaturesDraft] = useState<FeaturesDraft>(
		DEFAULT_FEATURES_DRAFT,
	)
	const [pendingAction, setPendingAction] = useState<string | null>(null)
	const ogImageUpload = useSiteImageUpload('Open Graph image')

	useEffect(() => {
		if (!settings) {
			return
		}

		setSeoDraft({
			siteDescription:
				settings.seo.siteDescription ??
				DEFAULT_SEO_DRAFT.siteDescription,
		})
		setSocialsDraft({
			discord: settings.socials.discord ?? '',
			youtube: settings.socials.youtube ?? '',
			instagram: settings.socials.instagram ?? '',
			bluesky: settings.socials.bluesky ?? '',
			tiktok: settings.socials.tiktok ?? '',
		})
		setFeaturesDraft({
			registrationEnabled: settings.features.registrationEnabled,
			maintenanceMode: settings.features.maintenanceMode,
		})
	}, [settings])

	async function resolveSiteImageR2Key(
		currentR2Key: string | undefined,
		upload: { file: File | null; removed: boolean },
	): Promise<string | null> {
		if (upload.removed) {
			return null
		}
		if (upload.file) {
			const { key, url } = await generateSiteImageUploadUrl({
				fileName: upload.file.name,
				imageKind: 'open-graph',
			})

			await uploadFileToPresignedUrl({
				file: upload.file,
				url,
			})
			await syncR2Metadata({ key })
			return key
		}
		return currentR2Key ?? null
	}

	const handleSaveSeo = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setPendingAction('seo')

		try {
			const ogImageR2Key = await resolveSiteImageR2Key(
				settings?.seo.ogImageR2Key,
				ogImageUpload,
			)
			await updateSeo({
				siteDescription:
					seoDraft.siteDescription.trim() ||
					DEFAULT_SEO_DRAFT.siteDescription,
				ogImageR2Key,
			})
			ogImageUpload.reset()
			toast.success('SEO settings saved')
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not save SEO settings',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handleSaveSocials = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setPendingAction('socials')

		try {
			await updateSocials({
				discord: optionalString(socialsDraft.discord),
				youtube: optionalString(socialsDraft.youtube),
				instagram: optionalString(socialsDraft.instagram),
				bluesky: optionalString(socialsDraft.bluesky),
				tiktok: optionalString(socialsDraft.tiktok),
			})
			toast.success('Social links saved')
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not save social links',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handleSaveFeatures = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setPendingAction('features')

		try {
			await updateFeatures(featuresDraft)
			toast.success('Feature flags saved')
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not save feature flags',
			)
		} finally {
			setPendingAction(null)
		}
	}

	if (settings === undefined) {
		return <AdminSettingsSkeleton />
	}

	return (
		<div className="min-w-0 space-y-6">
			<AdminPageHeader
				description="Manage public metadata, social links, and operational flags."
				title="Settings"
			/>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
				<Card>
					<CardHeader>
						<CardTitle>Search &amp; Sharing</CardTitle>
						<CardDescription>
							Manage the default site description and social
							sharing image.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleSaveSeo}>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="site-description">
										Description
									</Label>
									<Textarea
										disabled={pendingAction === 'seo'}
										id="site-description"
										maxLength={160}
										onChange={(event) =>
											setSeoDraft({
												...seoDraft,
												siteDescription:
													event.target.value,
											})
										}
										value={seoDraft.siteDescription}
									/>
									<p className="text-right text-muted-foreground text-xs">
										{seoDraft.siteDescription.length}/160
									</p>
								</div>
								<SiteImageUploadField
									currentUrl={settings.seo.ogImageUrl}
									description="Used when links are shared on Discord and social platforms. Recommended size: 1200 x 630."
									disabled={pendingAction === 'seo'}
									file={ogImageUpload.file}
									handleFileChange={
										ogImageUpload.handleFileChange
									}
									inputRef={ogImageUpload.inputRef}
									label="Open Graph Image"
									preview={ogImageUpload.preview}
									remove={ogImageUpload.remove}
									removed={ogImageUpload.removed}
									undoRemove={ogImageUpload.undoRemove}
								/>
							</div>
							<Button
								disabled={pendingAction === 'seo'}
								type="submit"
							>
								<HugeiconsIcon
									className="size-4"
									icon={Tick02Icon}
								/>
								{pendingAction === 'seo'
									? 'Saving...'
									: 'Save SEO'}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Feature Flags</CardTitle>
						<CardDescription>
							Operational toggles for public interaction surfaces.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="space-y-4"
							onSubmit={handleSaveFeatures}
						>
							<FeatureToggle
								checked={featuresDraft.registrationEnabled}
								description="Allow new accounts to be created through the registration page and auth API."
								disabled={pendingAction === 'features'}
								id="registration-enabled"
								label="Registration"
								onChange={(registrationEnabled) =>
									setFeaturesDraft({
										...featuresDraft,
										registrationEnabled,
									})
								}
							/>
							<FeatureToggle
								checked={featuresDraft.maintenanceMode}
								description="Temporarily redirect public and dashboard pages to the maintenance screen. Admin access remains available."
								disabled={pendingAction === 'features'}
								id="maintenance-mode"
								label="Maintenance Mode"
								onChange={(maintenanceMode) =>
									setFeaturesDraft({
										...featuresDraft,
										maintenanceMode,
									})
								}
							/>
							<Button
								disabled={pendingAction === 'features'}
								type="submit"
							>
								<HugeiconsIcon
									className="size-4"
									icon={Settings01Icon}
								/>
								{pendingAction === 'features'
									? 'Saving...'
									: 'Save Feature Flags'}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Social Links</CardTitle>
					<CardDescription>
						Public channels used in footer, home, and community
						surfaces.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleSaveSocials}>
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{(
								[
									['discord', 'Discord'],
									['youtube', 'YouTube'],
									['instagram', 'Instagram'],
									['bluesky', 'Bluesky'],
									['tiktok', 'TikTok'],
								] as const
							).map(([key, label]) => (
								<div className="space-y-2" key={key}>
									<Label htmlFor={`social-${key}`}>
										{label}
									</Label>
									<Input
										disabled={pendingAction === 'socials'}
										id={`social-${key}`}
										onChange={(event) =>
											setSocialsDraft({
												...socialsDraft,
												[key]: event.target.value,
											})
										}
										placeholder="https://..."
										value={socialsDraft[key]}
									/>
								</div>
							))}
						</div>
						<Button
							disabled={pendingAction === 'socials'}
							type="submit"
						>
							<HugeiconsIcon
								className="size-4"
								icon={Tick02Icon}
							/>
							{pendingAction === 'socials'
								? 'Saving...'
								: 'Save Social Links'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
