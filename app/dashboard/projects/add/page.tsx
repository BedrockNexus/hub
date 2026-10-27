import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
export default function Page() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl">
					What would you like to publish?
				</h1>
				<p className="mt-2 text-muted-foreground">
					Choose a content type to get started.
				</p>
			</div>
			<div className="flex flex-wrap gap-3">
				<Link
					className={buttonVariants({ variant: 'brand' })}
					href="/dashboard/addons/add"
				>
					Create an addon
				</Link>
				<Link
					className={buttonVariants({ variant: 'outline' })}
					href="/dashboard/resource-packs/add"
				>
					Create a resource pack
				</Link>
			</div>
		</div>
	)
}
