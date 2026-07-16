'use client'

import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { type Control, Controller, type UseFormWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import type { Id } from '@/convex/_generated/dataModel'
import type { ProjectFormData } from '@/lib/schemas/projects'

interface Category {
	_id: Id<'projectCategories'>
	name: string
	slug: string
}

interface ProjectCategoryPickerProps {
	control: Control<ProjectFormData>
	watch: UseFormWatch<ProjectFormData>
	categories: Category[] | undefined
	onToggle: (categoryId: string) => void
}

export function ProjectCategoryPicker({
	control,
	watch,
	categories,
	onToggle,
}: ProjectCategoryPickerProps) {
	const selectedIds = watch('categoryIds')

	return (
		<Controller
			control={control}
			name="categoryIds"
			render={({ fieldState }) => (
				<Field data-invalid={fieldState.invalid}>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{categories?.map((category) => {
							const isSelected = selectedIds.includes(
								category._id,
							)
							return (
								<Button
									className="h-auto justify-start py-3"
									key={category._id}
									onClick={() => onToggle(category._id)}
									type="button"
									variant={isSelected ? 'default' : 'outline'}
								>
									{isSelected && (
										<HugeiconsIcon
											className="mr-2 size-4"
											icon={CheckmarkCircle02Icon}
										/>
									)}
									{category.name}
								</Button>
							)
						})}
					</div>

					{fieldState.error && (
						<FieldError errors={[fieldState.error]} />
					)}

					<p className="mt-3 text-muted-foreground text-sm">
						Selected: {selectedIds.length}
					</p>
				</Field>
			)}
		/>
	)
}

export function createProjectCategoryToggler(
	getValues: () => string[],
	setValue: (
		name: 'categoryIds',
		value: string[],
		options?: { shouldDirty?: boolean; shouldValidate?: boolean },
	) => void,
) {
	return (categoryId: string) => {
		const current = getValues()
		if (current.includes(categoryId)) {
			setValue(
				'categoryIds',
				current.filter((id) => id !== categoryId),
				{ shouldDirty: true, shouldValidate: true },
			)
		} else {
			setValue('categoryIds', [...current, categoryId], {
				shouldDirty: true,
				shouldValidate: true,
			})
		}
	}
}
