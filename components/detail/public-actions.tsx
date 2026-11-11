'use client'

import { Share01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type ActionSize = 'sm' | 'xl'

export function ShareButton({
	title,
	size = 'sm',
}: {
	title: string
	size?: ActionSize
}) {
	const [pending, setPending] = useState(false)

	const handleShare = async () => {
		setPending(true)
		try {
			const url = window.location.href
			if (navigator.share) {
				await navigator.share({ title, url })
			} else {
				await navigator.clipboard.writeText(url)
				toast.success('Link copied')
			}
		} catch (error) {
			if (error instanceof Error && error.name !== 'AbortError') {
				toast.error('Could not share this page')
			}
		} finally {
			setPending(false)
		}
	}

	return (
		<Button
			disabled={pending}
			onClick={handleShare}
			size={size}
			type="button"
			variant="outline"
		>
			<HugeiconsIcon icon={Share01Icon} />
			Share
		</Button>
	)
}
