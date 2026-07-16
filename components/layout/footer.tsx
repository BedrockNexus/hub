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

interface FooterProps {
	siteName?: string
	siteLogo?: string
	brandText?: string
	copyrightText?: string
	socials?: {
		discord?: string
		youtube?: string
		instagram?: string
		bluesky?: string
		tiktok?: string
	}
}

const NAV_LINKS = [
	{ title: 'Home', href: '/' },
	{ title: 'Servers', href: '/servers' },
	{ title: 'Projects', href: '/projects' },
	{ title: 'Blog', href: '/blog' },
]

const LEGAL_LINKS = [
	{ title: 'Privacy Policy', href: '/privacy' },
	{ title: 'Terms of Service', href: '/terms' },
]

export function Footer({
	siteName = 'BedrockNexus',
	siteLogo = '/icon.svg',
	brandText = 'The next-generation platform for Minecraft Bedrock content.',
	copyrightText,
	socials = {},
}: FooterProps) {
	const copyright =
		copyrightText ||
		`© ${new Date().getFullYear()} ${siteName}. All rights reserved.`

	const socialLinks = [
		{ href: socials.discord, icon: DiscordIcon, label: 'Discord' },
		{ href: socials.youtube, icon: YoutubeIcon, label: 'YouTube' },
		{ href: socials.instagram, icon: InstagramIcon, label: 'Instagram' },
		{ href: socials.bluesky, icon: BlueskyIcon, label: 'Bluesky' },
		{ href: socials.tiktok, icon: TiktokIcon, label: 'TikTok' },
	].flatMap((s) => (s.href ? [{ ...s, href: s.href }] : []))

	return (
		<footer className="border-t bg-muted">
			<div className="container mx-auto px-4 py-14 md:px-6">
				{/* Main grid */}
				<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
					{/* Brand column */}
					<div className="flex flex-col gap-5">
						<Link className="flex w-fit items-center" href="/">
							<Image
								alt={siteName}
								className="h-auto w-64"
								height={905}
								src={siteLogo}
								width={2000}
							/>
						</Link>
						<p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
							{brandText}
						</p>
						{/* Social icons */}
						{socialLinks.length > 0 && (
							<div className="flex gap-1">
								{socialLinks.map((social) => (
									<Link
										className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
										href={social.href}
										key={social.label}
										target="_blank"
									>
										<HugeiconsIcon
											className="size-4"
											icon={social.icon}
										/>
										<span className="sr-only">
											{social.label}
										</span>
									</Link>
								))}
							</div>
						)}
					</div>

					{/* Explore column */}
					<div className="flex flex-col gap-4">
						<h4 className="font-semibold text-foreground text-xs uppercase tracking-widest">
							Explore
						</h4>
						<ul className="flex flex-col gap-3">
							{NAV_LINKS.map((link) => (
								<li key={link.href}>
									<Link
										className="text-muted-foreground text-sm transition-colors hover:text-foreground"
										href={link.href}
									>
										{link.title}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Legal column */}
					<div className="flex flex-col gap-4">
						<h4 className="font-semibold text-foreground text-xs uppercase tracking-widest">
							Legal
						</h4>
						<ul className="flex flex-col gap-3">
							{LEGAL_LINKS.map((link) => (
								<li key={link.href}>
									<Link
										className="text-muted-foreground text-sm transition-colors hover:text-foreground"
										href={link.href}
									>
										{link.title}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Bottom bar */}
				<div className="mt-12 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-muted-foreground text-xs">{copyright}</p>
					<p className="text-muted-foreground/60 text-xs">
						Not affiliated with Mojang Studios or Microsoft.
					</p>
				</div>
			</div>
		</footer>
	)
}
