import Image from 'next/image'
import Link from 'next/link'
import { siteConfig } from '@/lib/site'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
	className?: string
	href?: string
	imageClassName?: string
	priority?: boolean
}

export function BrandMark({
	className,
	href = '/',
	imageClassName,
	priority = false,
}: BrandMarkProps) {
	return (
		<Link
			aria-label={`${siteConfig.name} home`}
			className={cn(
				'inline-flex w-fit shrink-0 items-center rounded-md',
				className,
			)}
			href={href}
		>
			<Image
				alt={siteConfig.name}
				className={cn('h-auto w-44 object-contain', imageClassName)}
				height={905}
				priority={priority}
				src="/images/bedrocknexus-logo.png"
				unoptimized
				width={2000}
			/>
		</Link>
	)
}
