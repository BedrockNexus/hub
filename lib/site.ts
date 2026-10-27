import {
	Home01Icon,
	Package01Icon,
	PaintBrush01Icon,
	PlugSocketIcon,
	ServerStack01Icon,
	Wifi01Icon,
} from '@hugeicons/core-free-icons'

export const siteConfig = {
	name: 'BedrockNexus',
	description:
		'Discover Minecraft Bedrock servers, addons and resource packs, and publish your own. Free for creators and server owners.',
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
		href: '/addons',
		label: 'Addons',
		icon: Package01Icon,
	},
	{
		href: '/resource-packs',
		label: 'Resource Packs',
		icon: PaintBrush01Icon,
	},
] as const

/** The Tools menu in the header. */
export const toolsNavigation = [
	{
		href: '/tools/server-ping',
		label: 'Server Ping',
		description: 'Check whether a Bedrock server is online.',
		icon: Wifi01Icon,
	},
] as const

/** Shown in navigation only while the Plugins feature is switched on. */
export const pluginsNavigation = {
	href: '/plugins',
	label: 'Plugins',
	icon: PlugSocketIcon,
} as const

export const legalNavigation = [
	{ href: '/privacy', label: 'Privacy Policy' },
	{ href: '/terms', label: 'Terms of Service' },
] as const
