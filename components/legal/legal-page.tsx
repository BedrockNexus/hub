import Link from 'next/link'
import type { ReactNode } from 'react'

const LEGAL_LINKS = [
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/terms', label: 'Terms' },
]

interface LegalPageProps {
	children: ReactNode
	description: string
	lastUpdated: string
	title: string
}

export function LegalPage({
	children,
	description,
	lastUpdated,
	title,
}: LegalPageProps) {
	return (
		<div className="border-t bg-background">
			<header className="border-b bg-muted/30">
				<div className="container mx-auto max-w-4xl px-4 pt-28 pb-10 md:px-6">
					<p className="font-medium text-muted-foreground text-sm">
						Bedrock Nexus legal
					</p>
					<h1 className="mt-2 font-bold text-3xl tracking-normal md:text-4xl">
						{title}
					</h1>
					<p className="mt-4 max-w-2xl text-muted-foreground leading-7">
						{description}
					</p>
					<p className="mt-4 text-muted-foreground text-sm">
						Last updated: {lastUpdated}
					</p>
				</div>
			</header>

			<div className="container mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
				<nav
					aria-label="Legal pages"
					className="mb-10 flex flex-wrap gap-5 border-b pb-5"
				>
					{LEGAL_LINKS.map((link) => (
						<Link
							className="font-medium text-muted-foreground text-sm hover:text-foreground"
							href={link.href}
							key={link.href}
						>
							{link.label}
						</Link>
					))}
				</nav>

				<article className="prose prose-neutral dark:prose-invert max-w-none prose-a:text-primary prose-headings:tracking-normal">
					{children}
				</article>
			</div>
		</div>
	)
}
