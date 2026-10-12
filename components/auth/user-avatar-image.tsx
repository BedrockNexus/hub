'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAvatarUrl } from '@/lib/avatar-url'
import { cn } from '@/lib/utils'

interface UserAvatarImageProps {
	image?: string | null
	username: string
	size?: number
	className?: string
	avatarClassName?: string
}

/**
 * A person's or organization's picture. Without one it is a tile with the
 * first letter of the name, in whatever shape the caller gave the avatar.
 */
export function UserAvatarImage({
	image,
	username,
	size,
	className,
	avatarClassName,
}: UserAvatarImageProps) {
	const resolvedSize = size ?? 32
	const avatarUrl = getAvatarUrl(image)
	const fallbackInitial = username?.trim()?.charAt(0)?.toUpperCase() || '?'

	return (
		<Avatar
			className={cn('size-8', className, avatarClassName)}
			style={size ? { height: size, width: size } : undefined}
		>
			{avatarUrl ? <AvatarImage alt={username} src={avatarUrl} /> : null}
			<AvatarFallback
				className="tile-bevel rounded-[inherit] bg-stone font-bold font-display text-white"
				style={{
					fontSize: Math.max(10, Math.round(resolvedSize * 0.4)),
				}}
			>
				{fallbackInitial}
			</AvatarFallback>
		</Avatar>
	)
}
