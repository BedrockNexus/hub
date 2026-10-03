import {
	SecurityCheckIcon,
	StarIcon,
	UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/** Online / offline / unknown pill used on cards, rows and detail pages. */
export function ServerStatusLabel({
	online,
	className,
}: {
	online?: boolean
	className?: string
}) {
	if (online === true) {
		return (
			<span
				className={cn(
					'inline-flex items-center gap-1.5 font-semibold text-[13px] text-online',
					className,
				)}
			>
				<span className="size-2 rounded-full bg-online" />
				Online
			</span>
		)
	}
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 font-semibold text-[13px] text-offline',
				className,
			)}
		>
			<span className="size-2 rounded-full border-2 border-offline" />
			{online === false ? 'Offline' : 'Not checked yet'}
		</span>
	)
}

export function PlayerCount({
	online,
	playerCount,
	maxPlayers,
	className,
}: {
	online?: boolean
	playerCount?: number
	maxPlayers?: number
	className?: string
}) {
	const text = online
		? `${(playerCount ?? 0).toLocaleString()}${maxPlayers ? `/${maxPlayers.toLocaleString()}` : ''}`
		: '-'
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 font-mono text-[13px] text-muted-foreground',
				className,
			)}
		>
			<HugeiconsIcon
				aria-hidden
				className="size-3.5"
				icon={UserGroupIcon}
			/>
			<span className="sr-only">Players:</span>
			{text}
		</span>
	)
}

export function RatingLabel({
	averageRating,
	reviewCount,
	className,
}: {
	averageRating?: number
	reviewCount?: number
	className?: string
}) {
	const count = reviewCount ?? 0
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 text-[13px] text-muted-foreground',
				className,
			)}
		>
			<HugeiconsIcon
				aria-hidden
				className="size-3.5 fill-primary text-primary"
				icon={StarIcon}
			/>
			{count > 0 ? (
				<>
					<span className="font-semibold text-foreground">
						{(averageRating ?? 0).toFixed(1)}
					</span>
					<span>
						· {count} review{count === 1 ? '' : 's'}
					</span>
				</>
			) : (
				'No reviews'
			)}
		</span>
	)
}

export function VerifiedMark({ className }: { className?: string }) {
	return (
		<span
			className={cn('inline-flex text-ember-text', className)}
			title="Ownership verified"
		>
			<HugeiconsIcon
				aria-hidden
				className="size-4.5"
				icon={SecurityCheckIcon}
			/>
			<span className="sr-only">Verified owner</span>
		</span>
	)
}

/** Square logo tile with the block bevel; falls back to the initial. */
export function LogoTile({
	name,
	src,
	size = 56,
	className,
}: {
	name: string
	src?: string | null
	size?: number
	className?: string
}) {
	return (
		<div
			className={cn(
				'tile-bevel relative grid shrink-0 place-items-center overflow-hidden rounded-sm bg-stone font-bold font-display text-white',
				className,
			)}
			style={{ width: size, height: size, fontSize: size / 2 }}
		>
			{src ? (
				<Image
					alt=""
					className="object-cover"
					fill
					sizes={`${size}px`}
					src={src}
				/>
			) : (
				<span aria-hidden>{name.charAt(0).toUpperCase()}</span>
			)}
		</div>
	)
}

export function TagChip({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex h-6 items-center rounded-sm border bg-muted px-2 font-medium text-muted-foreground text-xs">
			{children}
		</span>
	)
}
