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

export function UserAvatarImage({
	image,
	username,
	size,
	className,
	avatarClassName,
}: UserAvatarImageProps) {
	const resolvedSize = size ?? 32
	const avatarUrl = getAvatarUrl(image, username, resolvedSize)
	const fallbackInitial = username?.trim()?.charAt(0)?.toUpperCase() ?? '?'

	return (
		<Avatar
			className={cn('size-8', className, avatarClassName)}
			style={size ? { height: size, width: size } : undefined}
		>
			<AvatarImage alt={username} src={avatarUrl} />
			<AvatarFallback>{fallbackInitial}</AvatarFallback>
		</Avatar>
	)
}
