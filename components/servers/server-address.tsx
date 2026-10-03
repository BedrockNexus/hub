'use client'

import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Bedrock's default port; it is shown dimmed and still copied. */
const DEFAULT_PORT = 19_132

export function formatServerAddress(host: string, port: number) {
	return `${host}:${port}`
}

/**
 * The server address with a copy button: the main action on every server
 * surface. `size="lg"` is the detail-page variant with a label.
 */
export function ServerAddress({
	host,
	port,
	serverName,
	size = 'default',
	className,
}: {
	host: string
	port: number
	serverName: string
	size?: 'default' | 'lg'
	className?: string
}) {
	const [copied, setCopied] = useState(false)
	const timeout = useRef<ReturnType<typeof setTimeout>>(null)
	useEffect(
		() => () => {
			if (timeout.current) {
				clearTimeout(timeout.current)
			}
		},
		[],
	)

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(formatServerAddress(host, port))
			setCopied(true)
			toast.success('Server address copied')
			if (timeout.current) {
				clearTimeout(timeout.current)
			}
			timeout.current = setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error('Could not copy the address')
		}
	}

	const large = size === 'lg'
	return (
		<div
			className={cn(
				'relative z-10 flex min-w-0 items-stretch overflow-hidden rounded-sm bg-background',
				large ? 'border-2 border-edge' : 'border border-input',
				className,
			)}
		>
			<div
				className={cn(
					'flex min-w-0 flex-1 flex-col justify-center',
					large ? 'px-3.5 py-1.5' : 'px-3 py-2',
				)}
			>
				{large ? (
					<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
						Server address
					</span>
				) : null}
				<span
					className={cn(
						'font-medium font-mono',
						large
							? 'break-all font-semibold text-[17px]'
							: 'truncate text-[13px]',
					)}
				>
					{host}
					<span
						className={cn(
							port === DEFAULT_PORT && 'text-muted-foreground',
						)}
					>
						:{port}
					</span>
				</span>
			</div>
			<button
				aria-label={`Copy address for ${serverName}`}
				className={cn(
					'inline-flex shrink-0 items-center gap-1.5 bg-muted px-3 font-bold font-display text-[13px] uppercase transition-colors hover:bg-accent',
					large
						? 'min-h-12 border-edge border-l-2 px-4 text-sm'
						: 'min-h-10 border-input border-l',
				)}
				onClick={copy}
				type="button"
			>
				<HugeiconsIcon
					className={cn('size-4', copied && 'text-online')}
					icon={copied ? Tick02Icon : Copy01Icon}
				/>
				{copied ? 'Copied' : 'Copy'}
			</button>
		</div>
	)
}
