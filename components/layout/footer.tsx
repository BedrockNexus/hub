import {
	BlueskyIcon,
	DiscordIcon,
	InstagramIcon,
	TiktokIcon,
	YoutubeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { MAPS_UI_ENABLED } from '@/lib/maps-feature'
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
				...(MAPS_UI_ENABLED ? [{ href: '/maps', label: 'Maps' }] : []),
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
				...(MAPS_UI_ENABLED
					? [{ href: '/dashboard/maps/add', label: 'Publish a map' }]
					: []),
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
		<footer className="border-t bg-surface-sunken">
			<div aria-hidden className="strata h-3 border-ember border-b-2" />
			<div className="container mx-auto flex flex-wrap justify-between gap-10 px-4 pt-12 pb-8 md:px-6">
				<div className="flex max-w-sm flex-1 basis-72 flex-col gap-4">
					<div className="flex items-center gap-2.5">
						<Image
							alt=""
							className="size-11"
							height={88}
							src="/icon.png"
							unoptimized
							width={88}
						/>
						<span className="font-bold font-display text-xl">
							Bedrock Nexus
						</span>
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						The open-source home for Minecraft Bedrock servers,
						addons and the people who make them. An Amblydia
						project.
					</p>
					{socialLinks.length > 0 && (
						<div className="flex gap-1">
							{socialLinks.map((social) => (
								<a
									className="inline-grid size-10 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

				<div className="flex flex-wrap gap-14">
					{footerColumns(pluginsEnabled).map((column) => (
						<nav
							aria-label={column.title}
							className="flex flex-col gap-2.5"
							key={column.title}
						>
							<h2 className="font-bold font-display text-foreground text-xs uppercase tracking-[0.12em]">
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
					© {new Date().getFullYear()} {siteConfig.name}. Open source
					under AGPL-3.0.
				</p>
				<p>Not affiliated with Mojang Studios or Microsoft.</p>
			</div>
		</footer>
	)
}
