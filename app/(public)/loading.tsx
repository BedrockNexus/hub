import { Skeleton } from '@/components/ui/skeleton'

export default function PublicLoading() {
	return (
		<main
			aria-busy="true"
			className="container mx-auto w-full flex-1 px-4 py-12 sm:py-16 md:px-6"
		>
			<span className="sr-only">Loading page</span>
			<Skeleton className="h-3 w-32" />
			<Skeleton className="mt-5 h-12 max-w-xl" />
			<Skeleton className="mt-4 h-6 max-w-2xl" />
			<div className="mt-12 grid gap-5 md:grid-cols-3">
				{['first', 'second', 'third'].map((item) => (
					<Skeleton className="h-56 rounded-lg" key={item} />
				))}
			</div>
		</main>
	)
}
