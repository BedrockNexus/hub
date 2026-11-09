import {
	CheckmarkBadge01Icon,
	GithubIcon,
	PulseIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { siteConfig } from '@/lib/site'

const POINTS = [
	{
		icon: CheckmarkBadge01Icon,
		title: 'Reviewed by people',
		body: 'A moderator checks every addon, pack and plugin release before it goes live.',
	},
	{
		icon: PulseIcon,
		title: 'Live server status',
		body: 'Online status and player counts update on their own, so the list stays honest.',
	},
	{
		icon: GithubIcon,
		title: 'Open source',
		body: 'The whole site is AGPL-3.0 and built in the open on GitHub.',
		href: siteConfig.githubUrl,
	},
]

/** Three short reasons to trust what is listed here. */
export function TrustStrip() {
	return (
		<section className="container mx-auto px-4 pt-16 md:px-6">
			<ul className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
				{POINTS.map((point) => (
					<li
						className="flex gap-3.5 bg-card px-5 py-5"
						key={point.title}
					>
						<HugeiconsIcon
							aria-hidden
							className="mt-0.5 size-5 shrink-0 text-primary"
							icon={point.icon}
						/>
						<span className="flex flex-col gap-1">
							<span className="font-display font-semibold">
								{point.href ? (
									<a
										className="hover:text-primary hover:underline"
										href={point.href}
										rel="noopener"
										target="_blank"
									>
										{point.title}
									</a>
								) : (
									point.title
								)}
							</span>
							<span className="text-muted-foreground text-sm leading-relaxed">
								{point.body}
							</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}
