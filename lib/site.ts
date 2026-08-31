import {
	Home01Icon,
	Package01Icon,
	ServerStack01Icon,
	Wifi01Icon,
} from '@hugeicons/core-free-icons'

export const siteConfig = {
	name: 'BedrockNexus',
	description:
		'Discover Minecraft Bedrock servers, add-ons, resource packs, and community content.',
	url: 'https://bedrocknexus.com',
	githubUrl: 'https://github.com/BedrockNexus/hub',
} as const

export const homeNavigation = {
	href: '/',
	label: 'Home',
	icon: Home01Icon,
} as const

export const publicNavigation = [
	{
		href: '/servers',
		label: 'Servers',
		icon: ServerStack01Icon,
	},
	{
		href: '/projects',
		label: 'Projects',
		icon: Package01Icon,
	},
	{
		href: '/tools/server-ping',
		label: 'Server Ping',
		mobileLabel: 'Ping',
		icon: Wifi01Icon,
	},
] as const

export const legalNavigation = [
	{ href: '/privacy', label: 'Privacy Policy' },
	{ href: '/terms', label: 'Terms of Service' },
] as const
