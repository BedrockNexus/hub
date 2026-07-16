"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { PropsWithChildren } from "react"
import { usernamePlugin } from "@better-auth-ui/core/plugins"
import { useTheme } from "next-themes"

import { authClient } from "@/lib/auth-client"
import { deleteUserPlugin } from "@/lib/delete-user-plugin"
import { organizationPlugin } from "@/lib/organization-plugin"
import { themePlugin } from "@/lib/theme-plugin"
import { AuthProvider } from "./auth-provider"

function getOrganizationSlug(pathname: string) {
  const [dashboard, organizations, slug] = pathname.split("/").filter(Boolean)

  if (dashboard === "dashboard" && organizations === "organizations") {
    return slug ?? null
  }

  return null
}

export function NextAuthProvider({ children }: PropsWithChildren) {
  const router = useRouter()
  const pathname = usePathname()
  const organizationSlug = getOrganizationSlug(pathname)

  return (
    <AuthProvider
      localization={{
        auth: {
          signIn: "Login",
          signUp: "Register",
          forgotPassword: "Forgot your password?",
          resetPassword: "Reset Password",
          signOut: "Logout"
        }
      }}
      authClient={authClient}
      plugins={[
        usernamePlugin(),
        themePlugin({ useTheme }),
        deleteUserPlugin(),
        organizationPlugin({
          slug: organizationSlug,
          viewPaths: {
            organization: {
              settings: "settings",
              people: "members"
            }
          }
        })
      ]}
      emailAndPassword={{
        name: false
      }}
      basePaths={{
        auth: "",
        settings: "/dashboard/settings",
        organization: "/dashboard/organizations"
      }}
      viewPaths={{
        auth: {
          signIn: "login",
          signUp: "register",
          forgotPassword: "forgot-password",
          resetPassword: "reset-password",
          signOut: "logout"
        },
        settings: {
          account: "account",
          security: "sessions"
        }
      }}
      Link={Link}
      navigate={({ to, replace }) => {
        if (replace) {
          router.replace(to)
          return
        }

        router.push(to)
      }}
    >
      {children}
    </AuthProvider>
  )
}
