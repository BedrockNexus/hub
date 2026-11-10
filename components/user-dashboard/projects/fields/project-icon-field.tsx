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
			<FieldLabel>Icon</FieldLabel>
			<FieldDescription>
				A square image, 256 × 256 works best.
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
				sizeLabel="2MB"
			/>
		</Field>
	)
}
