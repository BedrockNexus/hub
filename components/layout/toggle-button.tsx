'use client'

import { DarkModeIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ModeToggle() {
	const { setTheme, resolvedTheme } = useTheme()

	return (
		<Button
			aria-label="Toggle theme"
			onClick={() =>
				setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
			}
			size="icon"
			variant="outline"
		>
			<HugeiconsIcon icon={DarkModeIcon} />
			<span className="sr-only">Toggle theme</span>
		</Button>
	)
}
