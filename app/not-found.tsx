import {
	Home01Icon,
	Package01Icon,
	ServerStack01Icon,
	UnavailableIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Image from 'next/image'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
			<section className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
				<Link aria-label="BedrockNexus home" href="/">
					<Image
						alt="BedrockNexus"
						className="h-auto w-72 max-w-full"
						height={905}
						priority
						src="/images/bedrocknexus-logo.png"
						width={2000}
					/>
				</Link>

				<div className="mt-8 flex size-12 items-center justify-center rounded-full border bg-muted text-muted-foreground">
					<HugeiconsIcon className="size-5" icon={UnavailableIcon} />
				</div>

				<p className="mt-5 font-semibold text-muted-foreground text-sm uppercase tracking-widest">
					404
				</p>
				<h1 className="mt-2 font-bold text-3xl tracking-tight sm:text-4xl">
					Page not found
				</h1>
				<p className="mt-3 max-w-md text-muted-foreground text-sm leading-relaxed sm:text-base">
					This page does not exist, moved, or was removed. The best
					place to get back on track is the public directory.
				</p>

				<div className="mt-8 flex flex-wrap justify-center gap-2">
					<Link className={buttonVariants()} href="/">
						<HugeiconsIcon className="size-4" icon={Home01Icon} />
						Home
					</Link>
					<Link
						className={buttonVariants({ variant: 'outline' })}
						href="/servers"
					>
						<HugeiconsIcon
							className="size-4"
							icon={ServerStack01Icon}
						/>
						Servers
					</Link>
					<Link
						className={buttonVariants({ variant: 'outline' })}
						href="/projects"
					>
						<HugeiconsIcon
							className="size-4"
							icon={Package01Icon}
						/>
						Projects
					</Link>
				</div>
			</section>
		</main>
	)
}
