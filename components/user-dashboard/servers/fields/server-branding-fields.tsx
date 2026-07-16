'use client'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { BannerUpload } from '@/components/uploads/banner-upload'
import { IconUpload } from '@/components/uploads/icon-upload'

interface ServerBrandingFieldsProps {
	/** Current logo URL (already resolved, not a storage ID) */
	currentLogoUrl?: string | null
	/** Current banner URL (already resolved, not a storage ID) */
	currentBannerUrl?: string | null
	/** Server name for alt text fallback */
	serverName: string
	/** Existing server id used in final R2 object paths */
	serverId: string
	/** Called with the R2 key when a new logo has been uploaded successfully */
	onLogoUploadComplete: (key: string) => void
	/** Called when the staged logo upload is removed */
	onLogoUploadRemoved: () => void
	/** Called with the R2 key when a new banner has been uploaded successfully */
	onBannerUploadComplete: (key: string) => void
	/** Called when the staged banner upload is removed */
	onBannerUploadRemoved: () => void
	/** Whether logo is marked for removal */
	removeLogo: boolean
	onRemoveLogo: () => void
	onUndoRemoveLogo: () => void
	/** Whether banner is marked for removal */
	removeBanner: boolean
	onRemoveBanner: () => void
	onUndoRemoveBanner: () => void
	/** Disables uploads (e.g. during submission) */
	disabled?: boolean
}

export function ServerBrandingFields({
	currentLogoUrl,
	currentBannerUrl,
	serverName,
	serverId,
	onLogoUploadComplete,
	onLogoUploadRemoved,
	onBannerUploadComplete,
	onBannerUploadRemoved,
	removeLogo,
	onRemoveLogo,
	onUndoRemoveLogo,
	removeBanner,
	onRemoveBanner,
	onUndoRemoveBanner,
	disabled,
}: ServerBrandingFieldsProps) {
	return (
		<>
			{/* Logo */}
			<Field>
				<FieldLabel>Server Logo</FieldLabel>
				<FieldDescription>
					Square image, recommended 256x256. PNG, JPG or GIF. Max 2MB.
				</FieldDescription>
				<IconUpload
					currentImageUrl={currentLogoUrl}
					disabled={disabled}
					entityId={serverId}
					hasCurrentImage={!!currentLogoUrl}
					imageKind="logo"
					isRemoved={removeLogo}
					maxSize={2 * 1024 * 1024}
					name={serverName}
					onRemove={onRemoveLogo}
					onUndoRemove={onUndoRemoveLogo}
					onUploadComplete={onLogoUploadComplete}
					onUploadRemoved={onLogoUploadRemoved}
					resourceType="servers"
					rounded="lg"
					sizeLabel="2MB"
				/>
			</Field>

			{/* Banner */}
			<Field>
				<FieldLabel>Server Banner</FieldLabel>
				<FieldDescription>
					Wide image, recommended 1200x400. PNG, JPG or GIF. Max 5MB.
				</FieldDescription>
				<BannerUpload
					currentImageUrl={currentBannerUrl}
					disabled={disabled}
					entityId={serverId}
					hasCurrentImage={!!currentBannerUrl}
					imageKind="banner"
					isRemoved={removeBanner}
					onRemove={onRemoveBanner}
					onUndoRemove={onUndoRemoveBanner}
					onUploadComplete={onBannerUploadComplete}
					onUploadRemoved={onBannerUploadRemoved}
					resourceType="servers"
				/>
			</Field>
		</>
	)
}
