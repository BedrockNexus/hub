'use client'

import { Alert01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface PublicErrorProps {
	error: Error & { digest?: string }
	reset: () => void
}

export default function PublicError({ error, reset }: PublicErrorProps) {
	useEffect(() => {
		console.error(error)
	}, [error])

	return (
		<main className="container mx-auto grid min-h-[65vh] max-w-7xl place-items-center px-4 py-16 text-center md:px-6">
			<div>
				<span className="mx-auto grid size-12 place-items-center rounded-lg bg-destructive/10 text-destructive">
					<HugeiconsIcon
						aria-hidden
						className="size-5"
						icon={Alert01Icon}
					/>
				</span>
				<h1 className="mt-5 font-bold text-2xl">
					This page hit an unexpected error
				</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Try the request again. Nothing on the page was changed.
				</p>
				<Button className="mt-6" onClick={reset} type="button">
					Try again
				</Button>
			</div>
		</main>
	)
}
