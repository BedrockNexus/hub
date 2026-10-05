import type { Metadata } from 'next'
import localFont from 'next/font/local'
import '@mdxeditor/editor/style.css'
import './globals.css'
import { headers } from 'next/headers'
import { NextAuthProvider } from '@/components/ba-ui/provider/next-auth-provider'
import { ConvexClientProvider } from '@/components/convex-client-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getToken } from '@/lib/auth-server'
import { getSiteUrl } from '@/lib/seo'
import { siteConfig } from '@/lib/site'
import { getSiteSeo } from '@/lib/site-settings'

// Brand type, self-hosted (no network fetch at build time): Chakra Petch for
// display, IBM Plex Sans for text, JetBrains Mono for addresses and numbers.
// Licensed under the SIL Open Font License; see the OFL-*.txt files.
const displayFont = localFont({
	src: [
		{
			path: './fonts/chakra-petch-latin-500-normal.woff2',
			weight: '500',
			style: 'normal',
		},
		{
			path: './fonts/chakra-petch-latin-600-normal.woff2',
			weight: '600',
			style: 'normal',
		},
		{
			path: './fonts/chakra-petch-latin-700-normal.woff2',
			weight: '700',
			style: 'normal',
		},
	],
	variable: '--font-display-family',
	display: 'swap',
})

const sansFont = localFont({
	src: [
		{
			path: './fonts/ibm-plex-sans-latin-400-normal.woff2',
			weight: '400',
			style: 'normal',
		},
		{
			path: './fonts/ibm-plex-sans-latin-500-normal.woff2',
			weight: '500',
			style: 'normal',
		},
		{
			path: './fonts/ibm-plex-sans-latin-600-normal.woff2',
			weight: '600',
			style: 'normal',
		},
		{
			path: './fonts/ibm-plex-sans-latin-700-normal.woff2',
			weight: '700',
			style: 'normal',
		},
	],
	variable: '--font-sans-family',
	display: 'swap',
})

const monoFont = localFont({
	src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
	weight: '100 800',
	variable: '--font-mono-family',
	display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
	const seo = await getSiteSeo()
	const description = seo.siteDescription || siteConfig.description
	const socialImage = seo.ogImageUrl ?? '/images/bedrocknexus-logo.png'

	return {
		metadataBase: new URL(getSiteUrl()),
		applicationName: siteConfig.name,
		title: {
			default: siteConfig.name,
			template: `%s | ${siteConfig.name}`,
		},
		description,
		icons: {
			icon: '/favicon.png',
			shortcut: '/favicon.png',
			apple: '/icon.png',
		},
		openGraph: {
			type: 'website',
			siteName: siteConfig.name,
			title: siteConfig.name,
			description,
			url: getSiteUrl(),
			images: [socialImage],
		},
		twitter: {
			card: 'summary_large_image',
			title: siteConfig.name,
			description,
			images: [socialImage],
		},
		robots: {
			index: true,
			follow: true,
		},
	}
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	// Set by proxy.ts; lets the next-themes inline script run under the CSP.
	const nonce = (await headers()).get('x-nonce') ?? undefined
	// Hands the session's Convex token to the client so authenticated queries
	// (admin and dashboard pages) don't first run signed out and throw.
	const initialToken = await getToken().catch(() => null)

	return (
		<html
			className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}
			lang="en"
			suppressHydrationWarning
		>
			<body className="antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					disableTransitionOnChange
					enableSystem
					nonce={nonce}
				>
					<TooltipProvider>
						<ConvexClientProvider initialToken={initialToken}>
							<NextAuthProvider>{children}</NextAuthProvider>
							<Toaster closeButton richColors />
						</ConvexClientProvider>
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
