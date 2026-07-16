'use client'

import Image from 'next/image'
import {
	FavouriteButton,
	ShareButton,
} from '@/components/detail/public-actions'
import type { Id } from '@/convex/_generated/dataModel'

export function ServerHeader(props: {
	name: string
	smallDescription?: string | null
	logoUrl?: string | null
	serverId: Id<'servers'>
}) {
	return (
		<div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
			<div className="flex items-end gap-4">
				<div className="shrink-0 rounded-xl ring-4 ring-background">
					{props.logoUrl ? (
						<Image
							alt={`${props.name} logo`}
							className="rounded-xl object-cover"
							height={80}
							src={props.logoUrl}
							width={80}
						/>
					) : (
						<div className="flex size-20 items-center justify-center rounded-xl bg-muted font-bold text-2xl">
							{props.name.charAt(0).toUpperCase()}
						</div>
					)}
				</div>

				<div className="pb-1">
					<h1 className="font-bold text-2xl md:text-3xl">
						{props.name}
					</h1>
					<p className="text-muted-foreground text-sm md:text-base">
						{props.smallDescription}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<FavouriteButton
					targetId={props.serverId}
					targetType="server"
				/>
				<ShareButton
					targetId={props.serverId}
					targetType="server"
					title={props.name}
				/>
			</div>
		</div>
	)
}
