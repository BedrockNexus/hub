import { Package01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'

/** A server software's logo, or a quiet placeholder when it has none. */
export function SoftwareLogo({
	className,
	logoUrl,
	size,
}: {
	className?: string
	logoUrl?: string
	/** Intrinsic size hint in pixels; set the rendered size with a size-* class. */
	size: number
}) {
	if (logoUrl) {
		return (
			// biome-ignore lint/performance/noImgElement: CDN logos are already 256px
			<img
				alt=""
				className={cn('shrink-0 rounded-lg object-cover', className)}
				height={size}
				src={logoUrl}
				width={size}
			/>
		)
	}
	return (
		<span
			aria-hidden="true"
			className={cn(
				'grid shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground',
				className,
			)}
		>
			<HugeiconsIcon className="size-[45%]" icon={Package01Icon} />
		</span>
	)
}
