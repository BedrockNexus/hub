import { cn } from '@/lib/utils'

export interface HeaderStat {
	label: string
	value: number
	/** Adds the green dot used for live counts, when the value is above 0. */
	live?: boolean
}

/** A row of large figures for a page's header band. */
export function HeaderStats({ stats }: { stats: readonly HeaderStat[] }) {
	return (
		<dl className="flex flex-wrap gap-x-10 gap-y-4 pt-2">
			{stats.map((stat) => (
				<div className="flex flex-col gap-1" key={stat.label}>
					<dt className="order-2 text-muted-foreground text-sm">
						{stat.label}
					</dt>
					<dd
						className={cn(
							'flex items-center gap-2 font-mono font-semibold text-3xl tabular-nums leading-none',
							stat.value === 0 && 'text-muted-foreground',
						)}
					>
						{stat.live && stat.value > 0 ? (
							<span
								aria-hidden="true"
								className="size-2 rounded-full bg-online"
							/>
						) : null}
						{stat.value.toLocaleString()}
					</dd>
				</div>
			))}
		</dl>
	)
}
