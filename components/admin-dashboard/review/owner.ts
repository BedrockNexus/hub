type ReviewOwner =
	| { type: 'organization'; name: string }
	| { type: 'user'; username?: string; displayUsername?: string }
	| null
	| undefined

/** The display name of a listing's owner. */
export function ownerLabel(owner: ReviewOwner) {
	if (!owner) {
		return 'Unknown creator'
	}
	return owner.type === 'organization'
		? owner.name
		: owner.displayUsername || owner.username || 'Unknown creator'
}
