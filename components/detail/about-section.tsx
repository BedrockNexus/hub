import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { Card, CardContent } from '@/components/ui/card'

interface AboutSectionProps {
	description?: string | null
}

export function AboutSection({ description }: AboutSectionProps) {
	return (
		<Card>
			<CardContent>
				<RichTextViewer content={description} />
			</CardContent>
		</Card>
	)
}
