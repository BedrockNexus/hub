import {
	BlueskyIcon,
	DiscordIcon,
	InstagramIcon,
	TiktokIcon,
	YoutubeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { legalNavigation, pluginsNavigation, siteConfig } from '@/lib/site'

interface FooterProps {
	socials?: {
		discord?: string
		youtube?: string
		instagram?: string
		bluesky?: string
		tiktok?: string
	}
	/** Until the registry is switched on here, Plugins links to its old site. */
	pluginsEnabled?: boolean
}

interface FooterLink {
	href: string
	label: string
	external?: boolean
}

function footerColumns(
	pluginsEnabled: boolean,
): { title: string; links: FooterLink[] }[] {
	return [
		{
			title: 'Discover',
			links: [
				{ href: '/servers', label: 'Servers' },
				{ href: '/addons', label: 'Addons' },
				{ href: '/resource-packs', label: 'Resource Packs' },
				{ href: '/trending', label: 'Trending' },
				{ href: '/picks', label: 'Picks' },
				{ href: '/creators', label: 'Creators' },
				{ href: '/organizations', label: 'Organizations' },
				{ href: '/software', label: 'Server software' },
				{ href: '/tools/server-ping', label: 'Server Ping' },
				...(pluginsEnabled
					? [{ href: pluginsNavigation.href, label: 'Plugins' }]
					: []),
			],
		},
		{
			title: 'Creators',
			links: [
				{ href: '/dashboard/servers/add', label: 'List a server' },
				{ href: '/dashboard/addons/add', label: 'Publish an addon' },
				{
					href: '/dashboard/resource-packs/add',
					label: 'Publish a resource pack',
				},
				...(pluginsEnabled
					? [
							{
								href: '/dashboard/plugins/new',
								label: 'Publish a plugin',
							},
						]
					: []),
				{
					href: '/dashboard/organizations',
					label: 'Your organizations',
				},
			],
		},
		{
			title: 'Project',
			links: [
				{ href: siteConfig.githubUrl, label: 'GitHub', external: true },
				...legalNavigation,
			],
		},
	]
}

export function Footer({ socials = {}, pluginsEnabled = false }: FooterProps) {
	const socialLinks = [
		{ href: socials.discord, icon: DiscordIcon, label: 'Discord' },
		{ href: socials.youtube, icon: YoutubeIcon, label: 'YouTube' },
		{ href: socials.instagram, icon: InstagramIcon, label: 'Instagram' },
		{ href: socials.bluesky, icon: BlueskyIcon, label: 'Bluesky' },
		{ href: socials.tiktok, icon: TiktokIcon, label: 'TikTok' },
	].flatMap((s) => (s.href ? [{ ...s, href: s.href }] : []))

	return (
		// Bedrock: the bottom of every page, and the foot of the home page's chunk.
		// Its ragged top row overlaps the page so the page shows through.
		<footer className="relative">
			<div
				aria-hidden
				className="chunk-edge chunk-edge-bedrock relative z-10 -mt-8"
			/>
			<div className="chunk-bedrock">
				<div className="container mx-auto flex flex-wrap justify-between gap-10 px-4 pt-10 pb-8 md:px-6">
					<div className="flex max-w-sm flex-1 basis-72 flex-col gap-4">
						<BrandMark withIcon />
						<p className="text-muted-foreground text-sm leading-relaxed">
							The open-source home for Minecraft Bedrock servers,
							addons and the people who make them. An Amblydia
							project.
						</p>
						{socialLinks.length > 0 && (
							<div className="flex gap-1">
								{socialLinks.map((social) => (
									<a
										className="inline-grid size-10 place-items-center rounded-md border bg-card text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
										href={social.href}
										key={social.label}
										rel="noopener"
										target="_blank"
									>
										<HugeiconsIcon
											className="size-4.5"
											icon={social.icon}
										/>
										<span className="sr-only">
											{social.label}
										</span>
									</a>
								))}
							</div>
						)}
					</div>

					<div className="flex flex-wrap gap-x-16 gap-y-10">
						{footerColumns(pluginsEnabled).map((column) => (
							<nav
								aria-label={column.title}
								className="flex flex-col gap-2.5"
								key={column.title}
							>
								<h2 className="font-display font-semibold text-foreground text-sm">
									{column.title}
								</h2>
								{column.links.map((link) =>
									link.external ? (
										<a
											className="text-muted-foreground text-sm transition-colors hover:text-foreground"
											href={link.href}
											key={link.href}
											rel="noopener"
											target="_blank"
										>
											{link.label}
										</a>
									) : (
										<Link
											className="text-muted-foreground text-sm transition-colors hover:text-foreground"
											href={link.href}
											key={link.href}
										>
											{link.label}
										</Link>
									),
								)}
							</nav>
						))}
					</div>
				</div>
				<div className="container mx-auto flex flex-col gap-2 border-t px-4 py-6 text-muted-foreground text-xs sm:flex-row sm:justify-between md:px-6">
					<p>
						© {new Date().getFullYear()} {siteConfig.name}. Open
						source under AGPL-3.0.
					</p>
					<p>Not affiliated with Mojang Studios or Microsoft.</p>
				</div>
			</div>
		</footer>
	)
}
