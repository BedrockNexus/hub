'use client'

import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useListOrganizations } from '@/hooks/use-organization'
import { authClient } from '@/lib/auth-client'

function OrgAvatar({ name, logo }: { name: string; logo?: string | null }) {
	return (
		<UserAvatarImage
			avatarClassName="size-5"
			image={logo}
			size={20}
			username={name}
		/>
	)
}

interface OrgSelectorProps {
	value: string | undefined
	onChange: (value: string | undefined) => void
}

export function OrgSelector({ value, onChange }: OrgSelectorProps) {
	const { organizations, loading } = useListOrganizations()
	const { data: session } = authClient.useSession()
	const user = session?.user
	const username = user?.name || 'You'

	const selectedOrg = organizations?.find((org) => org.id === value)

	return (
		<Select
			onValueChange={(v: string | null) =>
				onChange(v === 'personal' || !v ? undefined : v)
			}
			value={value ?? 'personal'}
		>
			<SelectTrigger id="organizationId">
				<SelectValue placeholder="Select owner">
					{value && selectedOrg ? (
						<span className="flex items-center gap-2">
							<OrgAvatar
								logo={selectedOrg.logo}
								name={selectedOrg.name}
							/>
							{selectedOrg.name}
						</span>
					) : (
						<span className="flex items-center gap-2">
							<OrgAvatar logo={user?.image} name={username} />
							{username}
						</span>
					)}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>Personal</SelectLabel>
					<SelectItem value="personal">
						<span className="flex items-center gap-2">
							<OrgAvatar logo={user?.image} name={username} />
							{username}
						</span>
					</SelectItem>
				</SelectGroup>
				{loading && (
					<SelectItem disabled value="loading">
						Loading organizations...
					</SelectItem>
				)}
				{organizations && organizations.length > 0 && (
					<SelectGroup>
						<SelectLabel>Organizations</SelectLabel>
						{organizations.map((org) => (
							<SelectItem key={org.id} value={org.id}>
								<span className="flex items-center gap-2">
									<OrgAvatar
										logo={org.logo}
										name={org.name}
									/>
									{org.name}
								</span>
							</SelectItem>
						))}
					</SelectGroup>
				)}
			</SelectContent>
		</Select>
	)
}
