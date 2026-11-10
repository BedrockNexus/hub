import { redirect } from 'next/navigation'

// The create screen lets you pick the kind of listing.
export default function Page() {
	redirect('/dashboard/addons/add')
}
