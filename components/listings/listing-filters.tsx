'use client'

import { Cancel01Icon, FilterIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'

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
			className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&_[data-slot=select-trigger]]:min-w-0 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
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

export function ListingSelect({
	label,
	value,
	options,
	onChange,
	disabled = false,
	displayValue,
}: {
	label: string
	value: string
	options: readonly ListingOption[]
	onChange: (value: string) => void
	disabled?: boolean
	displayValue?: string
}) {
	return (
		<Select
			disabled={disabled}
			onValueChange={(next) => {
				if (typeof next === 'string') {
					onChange(next)
				}
			}}
			value={value}
		>
			<SelectTrigger
				aria-label={label}
				className="w-full min-w-0 sm:w-auto"
			>
				<SelectValue>
					{displayValue ??
						options.find((option) => option.value === value)
							?.label ??
						label}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

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
	return (
		<ListingSelect
			disabled={searching}
			displayValue={searching ? 'Best match' : undefined}
			label="Sort by"
			onChange={onChange}
			options={options}
			value={value}
		/>
	)
}

export function ListingMultiSelect({
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
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						className="w-full justify-start sm:w-auto"
						variant="outline"
					/>
				}
			>
				<HugeiconsIcon aria-hidden="true" icon={FilterIcon} />
				{label}
				{values.length ? (
					<Badge className="ml-1 px-1.5" variant="secondary">
						{values.length}
					</Badge>
				) : null}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-0">
				<Command>
					<CommandInput
						placeholder={`Search ${label.toLowerCase()}...`}
					/>
					<CommandList>
						<CommandEmpty>No options found.</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem
									aria-label={`${option.label}${values.includes(option.value) ? ', selected' : ''}`}
									key={option.value}
									onSelect={() =>
										onChange(
											values.includes(option.value)
												? values.filter(
														(value) =>
															value !==
															option.value,
													)
												: [...values, option.value],
										)
									}
									value={option.label}
								>
									<Checkbox
										aria-hidden="true"
										checked={values.includes(option.value)}
										className="pointer-events-none"
										tabIndex={-1}
									/>
									{option.label}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
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
