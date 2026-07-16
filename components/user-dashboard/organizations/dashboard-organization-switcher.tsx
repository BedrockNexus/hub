'use client'

import { useRouter } from 'next/navigation'
import { OrganizationSwitcher } from '@/components/ba-ui/organization/organization-switcher'

export function DashboardOrganizationSwitcher() {
	const router = useRouter()

	return (
		<OrganizationSwitcher
			align="start"
			className="w-full justify-between overflow-hidden group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>div:first-child>div:last-child]:hidden group-data-[collapsible=icon]:[&>div:first-child]:gap-0 group-data-[collapsible=icon]:[&>svg]:hidden"
			setActive={(organization) => {
				router.push(
					organization
						? `/dashboard/organizations/${organization.slug}`
						: '/dashboard',
				)
			}}
			sideOffset={4}
		/>
	)
}
