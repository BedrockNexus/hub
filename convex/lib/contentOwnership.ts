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
