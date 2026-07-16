"use client"

import { useAuth } from "@better-auth-ui/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

type VerifyState = "idle" | "loading" | "success" | "error"

/**
 * Resolves verify-email tokens from Better Auth links and renders a
 * Better-Auth-UI-styled status card.
 */
export function VerifyEmail() {
  const searchParams = useSearchParams()
  const { authClient, basePaths, viewPaths } = useAuth()

  const token = searchParams.get("token")
  const callbackURL = searchParams.get("callbackURL") ?? `${basePaths.auth}/${viewPaths.auth.signIn}`

  const [status, setStatus] = useState<VerifyState>("idle")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("Missing or invalid verification token.")
      return
    }

    let cancelled = false
    setStatus("loading")

    authClient
      .verifyEmail({ query: { token, callbackURL } })
      .then(() => {
        if (cancelled) return
        setStatus("success")
        setMessage("Your email has been verified. You can now log in.")
      })
      .catch((error) => {
        if (cancelled) return
        setStatus("error")
        setMessage(error?.message || "Verification failed. Please request a new link.")
      })

    return () => {
      cancelled = true
    }
  }, [authClient, callbackURL, token])

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === "loading" ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            <span>Verifying...</span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{message}</p>
        )}

        {status === "success" && (
          <Link
            href={`${basePaths.auth}/${viewPaths.auth.signIn}`}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90"
          >
            Go to login
          </Link>
        )}
      </CardContent>
    </Card>
  )
}