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
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from '@/components/dice-ui/stat'
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
import { cn } from '@/lib/utils'
import { AdminPageHeader } from './admin-page-header'

interface SeoDraft {
	siteName: string
	siteDescription: string
	siteKeywords: string
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
	siteName: 'BedrockNexus',
	siteDescription: 'Discover the best Minecraft Bedrock servers',
	siteKeywords: '',
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
const SETTINGS_SKELETON_KEYS = ['seo', 'socials', 'features', 'storage']
const MAX_SITE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_SITE_IMAGE_TYPES = new Set([
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
])
const SITE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

type SiteImageKind = 'favicon' | 'logo' | 'open-graph'

function optionalString(value: string) {
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}

function parseKeywords(value: string) {
	const keywords = value
		.split(',')
		.map((keyword) => keyword.trim())
		.filter(Boolean)

	return keywords.length > 0 ? keywords : undefined
}

function formatDate(value?: number) {
	if (!value) {
		return 'Not saved yet'
	}

	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value))
}

function AdminSettingsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{SETTINGS_SKELETON_KEYS.map((key) => (
					<Skeleton className="h-28 rounded-xl" key={key} />
				))}
			</div>
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
	className,
	currentUrl,
	description,
	disabled,
	file,
	handleFileChange,
	inputRef,
	label,
	preview,
	previewShape,
	remove,
	removed,
	undoRemove,
}: {
	className?: string
	currentUrl?: string
	description: string
	disabled: boolean
	file: File | null
	handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
	inputRef: React.RefObject<HTMLInputElement | null>
	label: string
	preview: string | null
	previewShape: 'square' | 'wide'
	remove: () => void
	removed: boolean
	undoRemove: () => void
}) {
	const displayUrl = preview ?? (removed ? undefined : currentUrl)

	return (
		<div className={cn('space-y-3', className)}>
			<div className="space-y-1">
				<Label>{label}</Label>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
			{displayUrl && (
				<Image
					alt={`${label} preview`}
					className={cn(
						'border bg-muted object-contain',
						previewShape === 'wide'
							? 'aspect-[40/21] w-full max-w-md rounded-md'
							: 'size-20 rounded-lg',
					)}
					height={previewShape === 'wide' ? 315 : 80}
					src={displayUrl}
					unoptimized
					width={previewShape === 'wide' ? 600 : 80}
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
	const logoUpload = useSiteImageUpload('Site logo')
	const ogImageUpload = useSiteImageUpload('Open Graph image')
	const faviconUpload = useSiteImageUpload('Favicon')

	useEffect(() => {
		if (!settings) {
			return
		}

		setSeoDraft({
			siteName: settings.seo.siteName ?? DEFAULT_SEO_DRAFT.siteName,
			siteDescription:
				settings.seo.siteDescription ??
				DEFAULT_SEO_DRAFT.siteDescription,
			siteKeywords: settings.seo.siteKeywords?.join(', ') ?? '',
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
		imageKind: SiteImageKind,
		currentR2Key: string | undefined,
		upload: { file: File | null; removed: boolean },
	): Promise<string | null> {
		if (upload.removed) {
			return null
		}
		if (upload.file) {
			const { key, url } = await generateSiteImageUploadUrl({
				fileName: upload.file.name,
				imageKind,
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

	const socialLinkCount = Object.values(socialsDraft).filter(
		(value) => value.trim().length > 0,
	).length
	const keywordCount = parseKeywords(seoDraft.siteKeywords)?.length ?? 0

	const handleSaveSeo = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setPendingAction('seo')

		try {
			const [siteLogoR2Key, ogImageR2Key, faviconR2Key] =
				await Promise.all([
					resolveSiteImageR2Key(
						'logo',
						settings?.seo.siteLogoR2Key,
						logoUpload,
					),
					resolveSiteImageR2Key(
						'open-graph',
						settings?.seo.ogImageR2Key,
						ogImageUpload,
					),
					resolveSiteImageR2Key(
						'favicon',
						settings?.seo.faviconR2Key,
						faviconUpload,
					),
				])
			await updateSeo({
				siteName:
					seoDraft.siteName.trim() || DEFAULT_SEO_DRAFT.siteName,
				siteDescription:
					seoDraft.siteDescription.trim() ||
					DEFAULT_SEO_DRAFT.siteDescription,
				siteKeywords: parseKeywords(seoDraft.siteKeywords),
				siteLogoR2Key,
				ogImageR2Key,
				faviconR2Key,
			})
			logoUpload.reset()
			ogImageUpload.reset()
			faviconUpload.reset()
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

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<Stat>
					<StatLabel>Setting Records</StatLabel>
					<StatValue>{settings.settingCount}</StatValue>
					<StatDescription>
						{formatDate(settings.updatedAt)}
					</StatDescription>
				</Stat>
				<Stat>
					<StatLabel>SEO Keywords</StatLabel>
					<StatValue>{keywordCount}</StatValue>
					<StatDescription>
						Comma-separated metadata terms
					</StatDescription>
				</Stat>
				<Stat>
					<StatLabel>Social Links</StatLabel>
					<StatValue>{socialLinkCount}</StatValue>
					<StatDescription>
						Public footer and home links
					</StatDescription>
				</Stat>
				<Stat>
					<StatLabel>Maintenance</StatLabel>
					<StatValue>
						{featuresDraft.maintenanceMode ? 'On' : 'Off'}
					</StatValue>
					<StatDescription>Operational site flag</StatDescription>
				</Stat>
			</div>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
				<Card>
					<CardHeader>
						<CardTitle>SEO Metadata</CardTitle>
						<CardDescription>
							Defaults used by layout metadata and sharing
							surfaces.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleSaveSeo}>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="site-name">Site Name</Label>
									<Input
										disabled={pendingAction === 'seo'}
										id="site-name"
										maxLength={60}
										onChange={(event) =>
											setSeoDraft({
												...seoDraft,
												siteName: event.target.value,
											})
										}
										value={seoDraft.siteName}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="site-keywords">
										Keywords
									</Label>
									<Input
										disabled={pendingAction === 'seo'}
										id="site-keywords"
										onChange={(event) =>
											setSeoDraft({
												...seoDraft,
												siteKeywords:
													event.target.value,
											})
										}
										placeholder="minecraft, bedrock, servers"
										value={seoDraft.siteKeywords}
									/>
								</div>
								<div className="space-y-2 md:col-span-2">
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
									className="md:col-span-2"
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
									previewShape="wide"
									remove={ogImageUpload.remove}
									removed={ogImageUpload.removed}
									undoRemove={ogImageUpload.undoRemove}
								/>
								<SiteImageUploadField
									currentUrl={settings.seo.siteLogoUrl}
									description="Used in the site navigation, footer, and branded surfaces."
									disabled={pendingAction === 'seo'}
									file={logoUpload.file}
									handleFileChange={
										logoUpload.handleFileChange
									}
									inputRef={logoUpload.inputRef}
									label="Site Logo"
									preview={logoUpload.preview}
									previewShape="square"
									remove={logoUpload.remove}
									removed={logoUpload.removed}
									undoRemove={logoUpload.undoRemove}
								/>
								<SiteImageUploadField
									currentUrl={settings.seo.faviconUrl}
									description="Used in browser tabs and bookmarks. A square PNG is recommended."
									disabled={pendingAction === 'seo'}
									file={faviconUpload.file}
									handleFileChange={
										faviconUpload.handleFileChange
									}
									inputRef={faviconUpload.inputRef}
									label="Favicon"
									preview={faviconUpload.preview}
									previewShape="square"
									remove={faviconUpload.remove}
									removed={faviconUpload.removed}
									undoRemove={faviconUpload.undoRemove}
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
