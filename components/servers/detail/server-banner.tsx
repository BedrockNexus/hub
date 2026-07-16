'use client'

import Image from 'next/image'

export function ServerBanner(props: {
	name: string
	bannerUrl?: string | null
}) {
	return (
		<div className="relative h-48 bg-linear-to-r from-primary/20 to-primary/5 md:h-64">
			{props.bannerUrl ? (
				<Image
					alt={`${props.name} banner`}
					className="object-cover"
					fill
					priority
					sizes="100vw"
					src={props.bannerUrl}
				/>
			) : (
				<div className="absolute inset-0 bg-linear-to-br from-primary/30 via-primary/10 to-background" />
			)}
			<div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />
		</div>
	)
}
