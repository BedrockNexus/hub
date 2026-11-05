'use client'
import { useEffect, useState } from 'react'
export function useMinute() {
	const [now, setNow] = useState(
		() => Math.floor(Date.now() / 60_000) * 60_000,
	)
	useEffect(() => {
		const timer = setInterval(
			() => setNow(Math.floor(Date.now() / 60_000) * 60_000),
			60_000,
		)
		return () => clearInterval(timer)
	}, [])
	return now
}
