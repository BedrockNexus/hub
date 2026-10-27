'use client'

import type { Ref } from 'react'
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@/components/ui/combobox'
import { LICENSE_OPTIONS, type LicenseOption } from '@/lib/licenses'

interface LicenseComboboxProps {
	id: string
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	inputRef?: Ref<HTMLInputElement>
	name?: string
	disabled?: boolean
	invalid?: boolean
}

export function LicenseCombobox({
	id,
	value,
	onChange,
	onBlur,
	inputRef,
	name,
	disabled,
	invalid,
}: LicenseComboboxProps) {
	// Older listings and GitHub imports can contain a license outside this list.
	// Keep that exact value until the creator explicitly chooses a replacement.
	const options: LicenseOption[] = LICENSE_OPTIONS.some(
		(option) => option.value === value,
	)
		? LICENSE_OPTIONS
		: [...LICENSE_OPTIONS, { value, label: `${value} (current license)` }]
	const selected = options.find((option) => option.value === value) ?? null

	return (
		<>
			<Combobox
				autoHighlight
				disabled={disabled}
				isItemEqualToValue={(item, current) =>
					item.value === current.value
				}
				items={options}
				itemToStringLabel={(item) => item.label}
				itemToStringValue={(item) => item.value}
				name={name}
				onValueChange={(item) => onChange(item?.value ?? '')}
				value={selected}
			>
				<ComboboxInput
					aria-invalid={invalid || undefined}
					className="w-full"
					disabled={disabled}
					id={id}
					onBlur={onBlur}
					placeholder="Search licenses..."
					ref={inputRef}
				/>
				<ComboboxContent>
					<ComboboxEmpty>No licenses found.</ComboboxEmpty>
					<ComboboxList>
						{(option: LicenseOption) => (
							<ComboboxItem key={option.value} value={option}>
								{option.label}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
			{selected?.url ? (
				<a
					className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
					href={selected.url}
					rel="noreferrer noopener"
					target="_blank"
				>
					Read license details
				</a>
			) : null}
		</>
	)
}
