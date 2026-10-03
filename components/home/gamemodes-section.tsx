import Link from 'next/link'
import { SectionHeading } from '@/components/home/section-heading'

export interface GamemodeCategory {
	_id: string
	name: string
	slug: string
	serverCount: number
}

export function GamemodesSection({
	categories,
}: {
	categories: GamemodeCategory[]
}) {
	if (categories.length === 0) {
		return null
	}
	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-12 pb-6 md:px-6">
			<SectionHeading
				href="/servers"
				linkLabel="All servers"
				title="Pick how you play"
			/>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
				{categories.map((category) => (
					<Link
						className="strata relative flex min-h-28 flex-col justify-end overflow-hidden rounded-md border p-4 transition-colors hover:border-ember"
						href={`/servers?category=${encodeURIComponent(category.slug)}`}
						key={category._id}
					>
						<span
							aria-hidden
							className="absolute inset-0 bg-linear-to-b from-30% from-transparent to-black/80"
						/>
						<span className="relative font-bold font-display text-lg text-white">
							{category.name}
						</span>
						<span className="relative text-[13px] text-white/85">
							{category.serverCount.toLocaleString()} server
							{category.serverCount === 1 ? '' : 's'}
						</span>
					</Link>
				))}
			</div>
		</section>
	)
}
