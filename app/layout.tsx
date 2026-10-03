import type { Metadata } from 'next'
import { Chakra_Petch, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
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

// Brand type: Chakra Petch for display, IBM Plex Sans for text, JetBrains
// Mono for server addresses and numbers.
const displayFont = Chakra_Petch({
	subsets: ['latin'],
	weight: ['500', '600', '700'],
	variable: '--font-display-family',
})

const sansFont = IBM_Plex_Sans({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-sans-family',
})

const monoFont = JetBrains_Mono({
	subsets: ['latin'],
	variable: '--font-mono-family',
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
