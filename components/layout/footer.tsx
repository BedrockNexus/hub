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
import { legalNavigation, siteConfig } from '@/lib/site'

interface FooterProps {
	socials?: {
		discord?: string
		youtube?: string
		instagram?: string
		bluesky?: string
		tiktok?: string
	}
}

const footerColumns = [
	{
		title: 'Discover',
		links: [
			{ href: '/servers', label: 'Servers' },
			{ href: '/projects', label: 'Projects' },
			{ href: '/tools/server-ping', label: 'Server Ping' },
			{ href: siteConfig.pluginsUrl, label: 'Plugins', external: true },
		],
	},
	{
		title: 'Creators',
		links: [
			{ href: '/dashboard/servers/add', label: 'List a server' },
			{ href: '/dashboard/projects/add', label: 'Publish a project' },
			{ href: '/dashboard/organizations', label: 'Organizations' },
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

export function Footer({ socials = {} }: FooterProps) {
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
						The open-source community directory for Minecraft
						Bedrock Edition. An Amblydia project.
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
					{footerColumns.map((column) => (
						<nav
							aria-label={column.title}
							className="flex flex-col gap-2.5"
							key={column.title}
						>
							<h2 className="font-bold font-display text-foreground text-xs uppercase tracking-[0.12em]">
								{column.title}
							</h2>
							{column.links.map((link) =>
								'external' in link && link.external ? (
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
