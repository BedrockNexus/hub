import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	output: 'standalone',
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'cdn.bedrocknexus.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: '**.convex.cloud',
				pathname: '/api/storage/**',
			},
			{
				protocol: 'https',
				hostname: '**.r2.cloudflarestorage.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: '**.r2.dev',
				pathname: '/**',
			},
		],
	},
	skipTrailingSlashRedirect: true,
}

export default nextConfig
