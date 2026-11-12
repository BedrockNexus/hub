import Image from 'next/image'
import type { ComponentProps, ReactNode } from 'react'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { ReviewSection } from './review-layout'

type Detail = readonly [label: string, value: ReactNode]
type LinkField = readonly [label: string, url: string | undefined]

function hostAndPath(url: string) {
	try {
		const parsed = new URL(url)
		return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`
	} catch {
		return url
	}
}

/** Label and value rows; empty values read "Not provided". */
export function DetailList({ rows }: { rows: readonly Detail[] }) {
	return (
		<dl className="grid grid-cols-[minmax(120px,180px)_minmax(0,1fr)] px-4.5 text-[14.5px]">
			{rows.map(([label, value], index) => {
				const last = index === rows.length - 1
				const border = last ? '' : 'border-b'
				return (
					<div className="contents" key={label}>
						<dt className={`py-3 text-muted-foreground ${border}`}>
							{label}
						</dt>
						<dd className={`min-w-0 break-words py-3 ${border}`}>
							{value === undefined ||
							value === '' ||
							value === null ? (
								<span className="text-muted-foreground">
									Not provided
								</span>
							) : (
								value
							)}
						</dd>
					</div>
				)
			})}
		</dl>
	)
}

/**
 * The listing as people will see it once approved: banner, summary and
 * description, gallery, details and links.
 */
export function ListingPreview({
	bannerUrl,
	summary,
	description,
	relativeUrlBase,
	gallery,
	details,
	links,
	extra,
	awaitingReview = true,
}: {
	bannerUrl?: string
	summary?: string
	description?: string
	relativeUrlBase?: ComponentProps<typeof RichTextViewer>['relativeUrlBase']
	gallery: ComponentProps<typeof GalleryGrid>['items']
	details: readonly Detail[]
	links: readonly LinkField[]
	/** Type-specific cards, such as an addon's details. */
	extra?: ReactNode
	/** False for a listing with nothing waiting, which shows as it is now. */
	awaitingReview?: boolean
}) {
	const shownLinks = links.filter(([, url]) => url)
	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground text-sm">
				{awaitingReview
					? 'The listing as people will see it once it is approved.'
					: 'The listing as people see it now.'}
			</p>
			{bannerUrl ? (
				<Image
					alt="Banner"
					className="aspect-[3/1] w-full rounded-lg border object-cover"
					height={400}
					src={bannerUrl}
					width={1200}
				/>
			) : null}
			<section className="flex flex-col gap-3 rounded-lg border bg-card px-5 py-4.5">
				{summary ? <p className="font-semibold">{summary}</p> : null}
				{description?.trim() ? (
					<RichTextViewer
						className="text-muted-foreground"
						content={description}
						relativeUrlBase={relativeUrlBase}
					/>
				) : (
					<p className="text-muted-foreground text-sm">
						No description supplied.
					</p>
				)}
			</section>
			<ReviewSection title="Gallery">
				<div className="p-4.5">
					<GalleryGrid
						emptyDescription="No screenshots were supplied."
						emptyTitle="No gallery images"
						items={gallery}
					/>
				</div>
			</ReviewSection>
			<ReviewSection title="Details">
				<DetailList
					rows={[
						...details,
						[
							'Links',
							shownLinks.length ? (
								<span
									className="flex flex-col gap-1"
									key="links"
								>
									{shownLinks.map(([label, url]) => (
										<span key={label}>
											{label} ·{' '}
											<a
												className="break-all font-mono text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
												href={url}
												rel="noreferrer noopener"
												target="_blank"
											>
												{hostAndPath(url as string)}
											</a>
										</span>
									))}
								</span>
							) : undefined,
						],
					]}
				/>
			</ReviewSection>
			{extra}
		</div>
	)
}
