'use client'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { IconUpload } from '@/components/uploads/icon-upload'

interface ProjectIconFieldProps {
	currentIconUrl?: string | null
	disabled?: boolean
	projectId: string
	onRemoveIcon: () => void
	onIconUploadComplete: (key: string) => void
	onIconUploadRemoved: () => void
	onUndoRemoveIcon: () => void
	projectName: string
	removeIcon: boolean
}

export function ProjectIconField({
	currentIconUrl,
	disabled,
	projectId,
	onRemoveIcon,
	onIconUploadComplete,
	onIconUploadRemoved,
	onUndoRemoveIcon,
	projectName,
	removeIcon,
}: ProjectIconFieldProps) {
	return (
		<Field>
			<FieldLabel>Project Icon</FieldLabel>
			<FieldDescription>
				Optional square image, recommended 256x256. PNG, JPG or GIF. Max
				2MB.
			</FieldDescription>
			<IconUpload
				currentImageUrl={currentIconUrl}
				disabled={disabled}
				entityId={projectId}
				hasCurrentImage={!!currentIconUrl}
				imageKind="icon"
				isRemoved={removeIcon}
				maxSize={2 * 1024 * 1024}
				name={projectName}
				onRemove={onRemoveIcon}
				onUndoRemove={onUndoRemoveIcon}
				onUploadComplete={onIconUploadComplete}
				onUploadRemoved={onIconUploadRemoved}
				resourceType="projects"
				rounded="lg"
				sizeLabel="2MB"
			/>
		</Field>
	)
}
