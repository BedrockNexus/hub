'use client'

import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TARGETS = [
	{
		value: 'servers',
		label: 'Servers',
		placeholder: 'Server name or gamemode',
	},
	{
		value: 'projects',
		label: 'Projects',
		placeholder: 'Addon or resource pack name',
	},
] as const

type Target = (typeof TARGETS)[number]['value']

export function HeroSearch() {
	const [target, setTarget] = useState<Target>('servers')
	const active = TARGETS.find((item) => item.value === target) ?? TARGETS[0]

	return (
		<form action={`/${target}`} className="flex w-full max-w-3xl flex-col">
			<fieldset className="flex gap-1">
				<legend className="sr-only">Search in</legend>
				{TARGETS.map((item) => (
					<label
						className={cn(
							'inline-flex min-h-10 cursor-pointer items-center rounded-t-sm border border-b-0 px-4.5 font-bold font-display text-sm uppercase transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring',
							item.value === target
								? 'border-input bg-card text-foreground'
								: 'border-transparent text-muted-foreground hover:text-foreground',
						)}
						key={item.value}
					>
						<input
							checked={item.value === target}
							className="sr-only"
							form="hero-search-target"
							name="search-target"
							onChange={() => setTarget(item.value)}
							type="radio"
							value={item.value}
						/>
						{item.label}
					</label>
				))}
			</fieldset>
			<div className="flex flex-wrap gap-2.5 rounded-sm rounded-tl-none border border-input bg-card p-2.5">
				<label className="flex min-h-12 flex-[1_1_16rem] items-center gap-2.5 rounded-sm border bg-background px-3.5 text-muted-foreground focus-within:border-ring">
					<HugeiconsIcon
						aria-hidden
						className="size-4.5"
						icon={Search01Icon}
					/>
					<span className="sr-only">
						Search {active.label.toLowerCase()}
					</span>
					<input
						className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
						name="q"
						placeholder={active.placeholder}
						type="search"
					/>
				</label>
				<Button
					className="max-sm:w-full"
					size="xl"
					type="submit"
					variant="brand"
				>
					Search
				</Button>
			</div>
		</form>
	)
}
