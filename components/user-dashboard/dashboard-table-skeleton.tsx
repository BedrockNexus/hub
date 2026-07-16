import { Skeleton } from '@/components/ui/skeleton'

const STATS_SKELETON_KEYS = ['stats-1', 'stats-2', 'stats-3'] as const
const ROW_SKELETON_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5'] as const

export function DashboardTableSkeleton() {
	return (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-3">
				{STATS_SKELETON_KEYS.map((key) => (
					<div className="rounded-lg border bg-card p-4" key={key}>
						<Skeleton className="mb-2 h-4 w-24" />
						<Skeleton className="h-8 w-16" />
					</div>
				))}
			</div>
			<div className="flex gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-8 w-32" />
			</div>
			<div className="rounded-md border">
				<div className="space-y-3 p-4">
					{ROW_SKELETON_KEYS.map((key) => (
						<div className="flex items-center gap-4" key={key}>
							<Skeleton className="size-8 rounded" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-3 w-64" />
							</div>
							<Skeleton className="h-6 w-16" />
							<Skeleton className="h-4 w-32" />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
