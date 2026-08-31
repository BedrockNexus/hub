import type { Metadata } from 'next'
import { Geist, Geist_Mono, JetBrains_Mono } from 'next/font/google'
import '@mdxeditor/editor/style.css'
import './globals.css'
import { NextAuthProvider } from '@/components/ba-ui/provider/next-auth-provider'
import { ConvexClientProvider } from '@/components/convex-client-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getSiteUrl } from '@/lib/seo'
import { siteConfig } from '@/lib/site'
import { getSiteSeo } from '@/lib/site-settings'

const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin'],
	variable: '--font-sans',
})

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
})

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
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

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			className={jetbrainsMono.variable}
			lang="en"
			suppressHydrationWarning
		>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					disableTransitionOnChange
					enableSystem
				>
					<TooltipProvider>
						<ConvexClientProvider>
							<NextAuthProvider>{children}</NextAuthProvider>
							<Toaster closeButton richColors />
						</ConvexClientProvider>
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
