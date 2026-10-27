'use client'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { useFullOrganization } from '@/hooks/use-organization'
import type { ProjectType } from '@/lib/project-artifacts'
import { ContentManager } from './content-manager'
export function OrganizationContentManager({ type }: { type: ProjectType }) {
	const { slug } = useParams<{ slug: string }>()
	const { organization, loading } = useFullOrganization(slug)
	if (loading || !organization) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-16 w-full rounded-md" />
				<Skeleton className="h-64 w-full rounded-md" />
			</div>
		)
	}
	return (
		<ContentManager
			organizationId={organization.id}
			organizationName={organization.name}
			type={type}
		/>
	)
}
