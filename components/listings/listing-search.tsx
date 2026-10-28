'use client'

import { Cancel01Icon, SearchIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '@/components/ui/input-group'

export function ListingSearch({
	label,
	value,
	onChange,
	maxLength,
}: {
	label: string
	value: string
	onChange: (value: string) => void
	maxLength?: number
}) {
	const [input, setInput] = useState(value)
	useEffect(() => setInput(value), [value])
	useEffect(() => {
		if (input === value) {
			return
		}
		const timer = setTimeout(() => onChange(input), 300)
		return () => clearTimeout(timer)
	}, [input, value, onChange])
	return (
		<search aria-label={label}>
			<InputGroup className="h-11 bg-card">
				<InputGroupAddon>
					<HugeiconsIcon aria-hidden="true" icon={SearchIcon} />
				</InputGroupAddon>
				<InputGroupInput
					aria-label={label}
					className="[&::-webkit-search-cancel-button]:appearance-none"
					maxLength={maxLength}
					onChange={(event) => setInput(event.target.value)}
					placeholder={`${label}...`}
					type="search"
					value={input}
				/>
				{input ? (
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							aria-label="Clear search"
							onClick={() => {
								setInput('')
								onChange('')
							}}
							size="icon-sm"
						>
							<HugeiconsIcon
								aria-hidden="true"
								icon={Cancel01Icon}
							/>
						</InputGroupButton>
					</InputGroupAddon>
				) : null}
			</InputGroup>
		</search>
	)
}
