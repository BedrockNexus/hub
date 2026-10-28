'use client'

import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	ComboboxValue,
	useComboboxAnchor,
} from '@/components/ui/combobox'

export interface ListingOption {
	value: string
	label: string
}

export function ListingFilters({
	children,
	active,
	onClear,
	disabled = false,
}: {
	children: ReactNode
	active: boolean
	onClear: () => void
	disabled?: boolean
}) {
	return (
		<fieldset
			aria-busy={disabled}
			aria-label="Listing filters"
			className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
			disabled={disabled}
		>
			{children}
			{active ? (
				<Button
					className="text-muted-foreground"
					onClick={onClear}
					variant="ghost"
				>
					<HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
					Clear all
				</Button>
			) : null}
		</fieldset>
	)
}

/** Option values in, labels out, so selections stay plain URL strings. */
function labelOf(options: readonly ListingOption[]) {
	const labels = new Map(
		options.map((option) => [option.value, option.label]),
	)
	return (value: string) => labels.get(value) ?? value
}

function OptionList({
	label,
	toLabel,
}: {
	label: string
	toLabel: (value: string) => string
}) {
	return (
		<>
			<ComboboxInput
				aria-label={`Search ${label.toLowerCase()}`}
				placeholder="Search..."
				showTrigger={false}
			/>
			<ComboboxEmpty>No options found.</ComboboxEmpty>
			<ComboboxList>
				{(value: string) => (
					<ComboboxItem key={value} value={value}>
						{toLabel(value)}
					</ComboboxItem>
				)}
			</ComboboxList>
		</>
	)
}

/** Any of several values, picked from a button that names the filter. */
export function ListingCombobox({
	label,
	options,
	values,
	onChange,
}: {
	label: string
	options: readonly ListingOption[]
	values: string[]
	onChange: (values: string[]) => void
}) {
	const toLabel = labelOf(options)
	return (
		<Combobox
			// An empty list will not open, so say so rather than do nothing.
			disabled={options.length === 0}
			items={options.map((option) => option.value)}
			itemToStringLabel={toLabel}
			multiple
			onValueChange={onChange}
			value={values}
		>
			<ComboboxTrigger
				aria-label={label}
				render={
					<Button
						className="w-full min-w-0 justify-between font-normal sm:w-auto"
						variant="outline"
					/>
				}
			>
				<span className="truncate">
					{values.length === 1 ? toLabel(values[0]) : label}
				</span>
				{values.length > 1 ? (
					<Badge className="px-1.5" variant="secondary">
						{values.length}
					</Badge>
				) : null}
			</ComboboxTrigger>
			<ComboboxContent className="min-w-56">
				<OptionList label={label} toLabel={toLabel} />
			</ComboboxContent>
		</Combobox>
	)
}

/** Any of several values, typed into an input that shows them as chips. */
export function ListingChipsCombobox({
	label,
	placeholder,
	options,
	values,
	onChange,
}: {
	label: string
	placeholder: string
	options: readonly ListingOption[]
	values: string[]
	onChange: (values: string[]) => void
}) {
	const toLabel = labelOf(options)
	const anchor = useComboboxAnchor()
	return (
		<Combobox
			items={options.map((option) => option.value)}
			itemToStringLabel={toLabel}
			multiple
			onValueChange={onChange}
			value={values}
		>
			<ComboboxChips
				className="col-span-2 min-w-0 sm:min-w-64 sm:max-w-md"
				ref={anchor}
			>
				<ComboboxValue>
					{values.map((value) => (
						<ComboboxChip
							key={value}
							removeLabel={`Remove ${toLabel(value)}`}
						>
							{toLabel(value)}
						</ComboboxChip>
					))}
				</ComboboxValue>
				<ComboboxChipsInput
					aria-label={label}
					placeholder={values.length ? '' : placeholder}
				/>
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>No {label.toLowerCase()} found.</ComboboxEmpty>
				<ComboboxList>
					{(value: string) => (
						<ComboboxItem key={value} value={value}>
							{toLabel(value)}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
}

/** One ordering for the results; ignored while a search ranks them. */
export function ListingSort({
	value,
	options,
	onChange,
	searching,
}: {
	value: string
	options: readonly ListingOption[]
	onChange: (value: string) => void
	searching: boolean
}) {
	const toLabel = labelOf(options)
	return (
		<Combobox
			disabled={searching}
			items={options.map((option) => option.value)}
			itemToStringLabel={toLabel}
			onValueChange={(next) => {
				if (typeof next === 'string') {
					onChange(next)
				}
			}}
			value={value}
		>
			<ComboboxTrigger
				aria-label="Sort by"
				render={
					<Button
						className="w-full min-w-0 justify-between font-normal sm:w-auto"
						variant="outline"
					/>
				}
			>
				<span className="truncate">
					<span className="text-muted-foreground">Sort by: </span>
					{searching ? 'Best match' : toLabel(value)}
				</span>
			</ComboboxTrigger>
			<ComboboxContent className="min-w-56">
				<OptionList label="Sort options" toLabel={toLabel} />
			</ComboboxContent>
		</Combobox>
	)
}

export function ActiveListingFilter({
	label,
	onRemove,
}: {
	label: string
	onRemove: () => void
}) {
	return (
		<Badge className="max-w-full gap-1 pr-1" variant="secondary">
			<span className="truncate">{label}</span>
			<Button
				aria-label={`Remove ${label} filter`}
				className="size-5 shrink-0"
				onClick={onRemove}
				size="icon"
				variant="ghost"
			>
				<HugeiconsIcon
					aria-hidden="true"
					className="size-3"
					icon={Cancel01Icon}
				/>
			</Button>
		</Badge>
	)
}
