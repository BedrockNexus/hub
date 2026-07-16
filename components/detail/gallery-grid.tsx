import Image from 'next/image'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'

interface GalleryItem {
	_id: string
	caption?: string
	fileName: string
	url: string
}

interface GalleryGridProps {
	items: GalleryItem[] | undefined
	emptyDescription: string
	emptyTitle: string
}

export function GalleryGrid({
	items,
	emptyDescription,
	emptyTitle,
}: GalleryGridProps) {
	if (items === undefined) {
		return (
			<div className="grid gap-4 sm:grid-cols-2">
				{['one', 'two', 'three', 'four'].map((key) => (
					<div
						className="aspect-video animate-pulse rounded-lg bg-muted"
						key={key}
					/>
				))}
			</div>
		)
	}

	if (items.length === 0) {
		return (
			<Empty className="border border-border/70 border-dashed py-14">
				<EmptyHeader>
					<EmptyTitle>{emptyTitle}</EmptyTitle>
					<EmptyDescription>{emptyDescription}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{items.map((item) => (
				<figure
					className="overflow-hidden rounded-lg border bg-card"
					key={item._id}
				>
					<div className="relative aspect-video">
						<Image
							alt={item.caption || item.fileName}
							className="object-cover"
							fill
							sizes="(min-width: 1024px) 40vw, 100vw"
							src={item.url}
						/>
					</div>
					{item.caption ? (
						<figcaption className="border-t px-3 py-2 text-muted-foreground text-sm">
							{item.caption}
						</figcaption>
					) : null}
				</figure>
			))}
		</div>
	)
}
