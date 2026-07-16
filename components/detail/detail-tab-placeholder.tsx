import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DetailTabPlaceholderProps {
	title: string
	description: string
}

export function DetailTabPlaceholder({
	title,
	description,
}: DetailTabPlaceholderProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-muted-foreground">{description}</p>
			</CardContent>
		</Card>
	)
}
