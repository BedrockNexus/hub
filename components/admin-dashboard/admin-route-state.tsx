'use client'

import {
	DashboardBrowsingIcon,
	RefreshIcon,
	UnavailableIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

const STAT_SKELETON_KEYS = ['stat-one', 'stat-two', 'stat-three', 'stat-four']
const TABLE_SKELETON_KEYS = [
	'row-one',
	'row-two',
	'row-three',
	'row-four',
	'row-five',
	'row-six',
]
const LIST_SKELETON_KEYS = ['item-one', 'item-two', 'item-three', 'item-four']

interface AdminRouteErrorStateProps {
	description?: string
	onReset?: () => void
	title?: string
}

export function AdminRouteLoadingState() {
	return (
		<output className="block min-w-0 space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-full max-w-md" />
			</div>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{STAT_SKELETON_KEYS.map((key) => (
					<Skeleton className="h-28 rounded-xl" key={key} />
				))}
			</div>
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-64" />
					</CardHeader>
					<CardContent className="space-y-3">
						{TABLE_SKELETON_KEYS.map((key) => (
							<Skeleton className="h-10 w-full" key={key} />
						))}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-56" />
					</CardHeader>
					<CardContent className="space-y-3">
						{LIST_SKELETON_KEYS.map((key) => (
							<Skeleton className="h-16 w-full" key={key} />
						))}
					</CardContent>
				</Card>
			</div>
			<span className="sr-only">Loading admin dashboard</span>
		</output>
	)
}

export function AdminRouteErrorState({
	description = 'The admin dashboard could not finish loading this section.',
	onReset,
	title = 'Something went wrong',
}: AdminRouteErrorStateProps) {
	return (
		<Empty className="min-h-105 border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<HugeiconsIcon className="size-5" icon={UnavailableIcon} />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center">
				{onReset ? (
					<Button onClick={onReset}>
						<HugeiconsIcon className="size-4" icon={RefreshIcon} />
						Try Again
					</Button>
				) : null}
				<Button
					nativeButton={false}
					render={<Link href="/admin" />}
					variant="outline"
				>
					<HugeiconsIcon
						className="size-4"
						icon={DashboardBrowsingIcon}
					/>
					Admin Home
				</Button>
			</EmptyContent>
		</Empty>
	)
}

export function AdminRouteNotFoundState() {
	return (
		<AdminRouteErrorState
			description="That admin section does not exist or is not available in this build."
			title="Admin page not found"
		/>
	)
}
