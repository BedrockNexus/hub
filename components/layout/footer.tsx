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
import {
	homeNavigation,
	legalNavigation,
	publicNavigation,
	siteConfig,
} from '@/lib/site'

interface FooterProps {
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

const footerNavigation = [
	homeNavigation,
	...publicNavigation,
	{ href: '/blog', label: 'Blog' },
]

export function Footer({
	brandText = 'The next-generation platform for Minecraft Bedrock content.',
	copyrightText,
	socials = {},
}: FooterProps) {
	const copyright =
		copyrightText ||
		`© ${new Date().getFullYear()} ${siteConfig.name}. All rights reserved.`

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
				<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
					<div className="flex flex-col gap-5">
						<BrandMark imageClassName="w-64" />
						<p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
							{brandText}
						</p>
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

					<div className="flex flex-col gap-4">
						<h4 className="font-semibold text-foreground text-xs uppercase tracking-widest">
							Explore
						</h4>
						<ul className="flex flex-col gap-3">
							{footerNavigation.map((link) => (
								<li key={link.href}>
									<Link
										className="text-muted-foreground text-sm transition-colors hover:text-foreground"
										href={link.href}
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div className="flex flex-col gap-4">
						<h4 className="font-semibold text-foreground text-xs uppercase tracking-widest">
							Legal
						</h4>
						<ul className="flex flex-col gap-3">
							{legalNavigation.map((link) => (
								<li key={link.href}>
									<Link
										className="text-muted-foreground text-sm transition-colors hover:text-foreground"
										href={link.href}
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

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
