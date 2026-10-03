type OwnerReference = {
	ownerType: 'user' | 'organization'
	ownerId: string
}

export function canModifyProjectOwner(args: {
	owner: OwnerReference
	userId: string
	isOrganizationMember?: boolean
}): boolean {
	if (args.owner.ownerType === 'user') {
		return args.owner.ownerId === args.userId
	}
	return args.isOrganizationMember === true
}

export function canModifyServerOwner(args: {
	owner: OwnerReference & { registeredBy?: string }
	userId: string
	role?: string
	isOrganizationMember?: boolean
}): boolean {
	if (args.role === 'admin') return true
	if (args.owner.ownerType === 'user') {
		return (
			args.owner.ownerId === args.userId ||
			args.owner.registeredBy === args.userId
		)
	}
	return args.isOrganizationMember === true
}

/**
 * Better Auth stores organization roles as a comma-separated list. Owners and
 * admins may delete organization content or move it to another owner; plain
 * members may only edit it.
 */
export function isOrganizationManagerRole(role: string | null | undefined): boolean {
	return (role ?? '')
		.split(',')
		.map((value) => value.trim())
		.some((value) => value === 'owner' || value === 'admin')
}

/** Delete or transfer: the owning user, or an organization owner/admin. */
export function canManageContentOwner(args: {
	owner: OwnerReference
	userId: string
	role?: string
	organizationRole?: string | null
}): boolean {
	if (args.role === 'admin') return true
	if (args.owner.ownerType === 'user') {
		return args.owner.ownerId === args.userId
	}
	return isOrganizationManagerRole(args.organizationRole)
}
