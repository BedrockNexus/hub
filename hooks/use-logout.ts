'use client'

import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

// Routes that require authentication
const protectedRoutes = ['/dashboard']

export function useLogout() {
	const pathname = usePathname()
	const router = useRouter()

	const logout = async () => {
		await authClient.signOut()

		// Check if current route requires authentication
		const isProtectedRoute = protectedRoutes.some((route) =>
			pathname.startsWith(route),
		)

		if (isProtectedRoute) {
			router.push('/login')
		}
		// If not protected, stay on current page
	}

	return logout
}
