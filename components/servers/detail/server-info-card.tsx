import { Copy01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip'

type ServerCategory = { _id: string; name: string } | null

export function ServerInfoCard(props: {
	ipAddress: string
	port: number
	onCopyIP: () => void
	region?: string | null
	language?: string[] | null
	gameVersions?: string[] | null
	categories: ServerCategory[]
}) {
	const gameVersions = props.gameVersions ?? []
	const languages = props.language ?? []
	const categories = props.categories.flatMap((category) =>
		category ? [category] : [],
	)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Server Info</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-2">
					<h3 className="font-medium text-sm">IP Address</h3>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									aria-label="Copy server address"
									className="w-full justify-between gap-2"
									onClick={props.onCopyIP}
									variant="secondary"
								/>
							}
						>
							<code className="min-w-0 truncate font-mono text-sm">
								{props.ipAddress}:{props.port}
							</code>
							<HugeiconsIcon
								className="size-3.5"
								icon={Copy01Icon}
							/>
						</TooltipTrigger>
						<TooltipContent>Copy IP address</TooltipContent>
					</Tooltip>
				</div>

				<Separator />

				<div className="space-y-2">
					<h3 className="font-medium text-sm">Game Versions</h3>
					{gameVersions.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{gameVersions.map((version) => (
								<Badge key={version} variant="secondary">
									{version}
								</Badge>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No version info yet
						</p>
					)}
				</div>

				<Separator />

				<div className="space-y-2">
					<h3 className="font-medium text-sm">Region</h3>
					{props.region ? (
						<Badge variant="secondary">{props.region}</Badge>
					) : (
						<p className="text-muted-foreground text-sm">
							No region selected
						</p>
					)}
				</div>

				<Separator />

				<div className="space-y-2">
					<h3 className="font-medium text-sm">Languages</h3>
					{languages.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{languages.map((language) => (
								<Badge key={language} variant="secondary">
									{language}
								</Badge>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No languages selected
						</p>
					)}
				</div>

				<Separator />

				<div className="space-y-2">
					<h3 className="font-medium text-sm">Categories</h3>
					{categories.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{categories.map((category) => (
								<Badge key={category._id} variant="outline">
									{category.name}
								</Badge>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No categories yet
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
