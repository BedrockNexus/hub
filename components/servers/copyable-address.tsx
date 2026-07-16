'use client'

import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopyableAddress({ address }: { address: string }) {
	const [copied, setCopied] = useState(false)
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			timeoutRef.current = setTimeout(() => setCopied(false), 2000)
		} catch {
			// silently fail
		}
	}

	return (
		<Button
			className="h-auto gap-1.5 px-2 py-1 font-mono text-xs"
			onClick={handleCopy}
			variant="outline"
		>
			{address}
			<HugeiconsIcon
				className={`size-3.5 ${copied ? 'text-green-500' : ''}`}
				icon={copied ? Tick02Icon : Copy01Icon}
			/>
		</Button>
	)
}
