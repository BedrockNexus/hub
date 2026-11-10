'use client'

import { useId, useMemo } from 'react'
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from '@/components/ui/combobox'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'

export interface CategoryOption {
	_id: string
	name: string
}

interface CategoryMultiSelectProps<TId extends string> {
	/** Active categories for this kind of listing; undefined while loading. */
	categories: readonly CategoryOption[] | undefined
	value: TId[]
	onChange: (value: TId[]) => void
	description?: string
	disabled?: boolean
	error?: string
	/** Most categories a listing may have. */
	max?: number
	/** Tag the field for "at least one" rules. */
	required?: boolean
}

/**
 * Searchable multi select for a listing's categories, used on the General
 * page of every content edit dashboard (addons, resource packs, servers,
 * plugins). Values are category ids; chips show the names.
 *
 * A selected category that is no longer offered (turned off by an admin) still
 * shows as a chip, so saving never drops it without the creator seeing it.
 */
export function CategoryMultiSelect<TId extends string>({
	categories,
	value,
	onChange,
	description,
	disabled,
	error,
	max,
	required,
}: CategoryMultiSelectProps<TId>) {
	const inputId = useId()
	const anchor = useComboboxAnchor()

	const names = useMemo(
		() =>
			new Map(
				(categories ?? []).map((category) => [
					category._id,
					category.name,
				]),
			),
		[categories],
	)
	const items = useMemo(
		() => (categories ?? []).map((category) => category._id as TId),
		[categories],
	)

	if (categories === undefined) {
		return (
			<Field>
				<FieldLabel>Categories</FieldLabel>
				<Skeleton className="h-9 w-full" />
			</Field>
		)
	}

	const atLimit = max !== undefined && value.length >= max
	let placeholder = 'Add category'
	if (value.length === 0) {
		placeholder = 'Search categories'
	} else if (atLimit) {
		placeholder = ''
	}
	const limitText =
		max === undefined ? null : `${value.length} of ${max} selected`

	return (
		<Field data-invalid={Boolean(error)}>
			<FieldLabel htmlFor={inputId}>
				{required ? 'Categories *' : 'Categories'}
			</FieldLabel>
			{description ? (
				<FieldDescription>{description}</FieldDescription>
			) : null}
			{categories.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No categories have been set up yet.
				</p>
			) : (
				<Combobox
					// Enter adds the first match while searching.
					autoHighlight
					disabled={disabled}
					items={items}
					itemToStringLabel={(id: TId) => names.get(id) ?? id}
					multiple
					onValueChange={(next: TId[], details) => {
						// Base UI clears every pick when Escape is pressed with the
						// list closed. Escape should only close the list.
						if (details.reason === 'escape-key') {
							return
						}
						// Keep the limit: ignore an addition past it.
						if (
							max !== undefined &&
							next.length > max &&
							next.length > value.length
						) {
							return
						}
						onChange(next)
					}}
					value={value}
				>
					<ComboboxChips aria-invalid={Boolean(error)} ref={anchor}>
						<ComboboxValue>
							{value.map((id) => (
								<ComboboxChip key={id}>
									{names.get(id) ?? 'Unavailable category'}
								</ComboboxChip>
							))}
						</ComboboxValue>
						<ComboboxChipsInput
							aria-required={required}
							disabled={disabled}
							id={inputId}
							placeholder={placeholder}
						/>
					</ComboboxChips>
					<ComboboxContent anchor={anchor}>
						<ComboboxEmpty>No categories match.</ComboboxEmpty>
						<ComboboxList>
							{(id: TId) => (
								<ComboboxItem
									disabled={atLimit && !value.includes(id)}
									key={id}
									value={id}
								>
									{names.get(id)}
								</ComboboxItem>
							)}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			)}
			{limitText ? (
				<p className="text-muted-foreground text-xs">{limitText}</p>
			) : null}
			{error ? <FieldError>{error}</FieldError> : null}
		</Field>
	)
}
