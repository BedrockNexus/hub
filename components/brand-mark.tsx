import Image from 'next/image'
import Link from 'next/link'
import { siteConfig } from '@/lib/site'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
	className?: string
	href?: string
	imageClassName?: string
	priority?: boolean
	/** Show the block icon next to the wordmark. */
	withIcon?: boolean
}

export function BrandMark({
	className,
	href = '/',
	imageClassName,
	priority = false,
	withIcon = false,
}: BrandMarkProps) {
	return (
		<Link
			aria-label={`${siteConfig.name} home`}
			className={cn(
				'inline-flex w-fit shrink-0 items-center rounded-sm',
				className,
			)}
			href={href}
		>
			{withIcon ? (
				<Image
					alt=""
					className="-mr-2 size-10 object-contain"
					height={80}
					priority={priority}
					src="/icon.png"
					unoptimized
					width={80}
				/>
			) : null}
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
