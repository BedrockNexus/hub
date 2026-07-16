'use client'

import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useFullOrganization } from '@/hooks/use-organization'

export default function OrganizationLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const params = useParams()
	const slug = params.slug as string
	const { organization, loading, error } = useFullOrganization(slug)

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-4">
					<Skeleton className="size-12 rounded-lg" />
					<div className="space-y-2">
						<Skeleton className="h-7 w-48" />
						<Skeleton className="h-4 w-32" />
					</div>
				</div>
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-64 w-full rounded-lg" />
			</div>
		)
	}

	if (error || !organization) {
		return (
			<Empty className="py-20">
				<EmptyHeader>
					<EmptyMedia>
						<Avatar className="size-16">
							<AvatarFallback className="font-semibold text-2xl">
								?
							</AvatarFallback>
						</Avatar>
					</EmptyMedia>
					<EmptyTitle>Organization Not Found</EmptyTitle>
					<EmptyDescription>
						{error ??
							"The organization you're looking for doesn't exist or you don't have access."}
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Link
						className="text-primary text-sm hover:underline"
						href="/dashboard/organizations"
					>
						<HugeiconsIcon
							className="mr-1 inline size-4"
							icon={ArrowLeft02Icon}
						/>
						Back to organizations
					</Link>
				</EmptyContent>
			</Empty>
		)
	}

	return <>{children}</>
}
