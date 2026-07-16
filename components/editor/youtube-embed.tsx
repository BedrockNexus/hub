import { getYoutubeEmbedUrl } from '@/lib/youtube'

const youtubeIframePermissions =
	'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'

export function YoutubeEmbed({
	className,
	title = 'YouTube video',
	videoId,
}: {
	className?: string
	title?: string
	videoId: string
}) {
	const embedUrl = getYoutubeEmbedUrl(videoId)
	if (!embedUrl) {
		return null
	}

	return (
		<div className={className}>
			<iframe
				allow={youtubeIframePermissions}
				allowFullScreen
				className="absolute inset-0 size-full border-0"
				loading="lazy"
				referrerPolicy="strict-origin-when-cross-origin"
				src={embedUrl}
				title={title}
			/>
		</div>
	)
}
