"use client"

import { useAuth } from "@better-auth-ui/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

type VerifyState =
  | { status: "verifying" }
  | { status: "signedIn" }
  | { status: "verified" }
  | { status: "error"; message: string }

const DEFAULT_DESTINATION = "/dashboard"

/**
 * Where to go once logged in: the page the link asked for when it is a real
 * page on this site, otherwise the dashboard. Better Auth fills in "/" when
 * registering asked for nothing, so that counts as nothing too.
 */
function resolveDestination(callbackURL: string | null) {
  if (!callbackURL) return DEFAULT_DESTINATION

  try {
    const url = new URL(callbackURL, window.location.origin)
    if (url.origin !== window.location.origin) return DEFAULT_DESTINATION

    const path = `${url.pathname}${url.search}${url.hash}`
    return path === "/" ? DEFAULT_DESTINATION : path
  } catch {
    return DEFAULT_DESTINATION
  }
}

/**
 * The page a verification email links to. It confirms the token, which also
 * logs the person in (`autoSignInAfterVerification`), then moves on to the
 * dashboard. A used or expired link gets an explanation and a way forward.
 */
export function VerifyEmail() {
  const searchParams = useSearchParams()
  const { authClient, basePaths, localization, viewPaths } = useAuth()

  const token = searchParams.get("token")
  const callbackURL = searchParams.get("callbackURL")

  const [state, setState] = useState<VerifyState>(
    token
      ? { status: "verifying" }
      : { status: "error", message: "This verification link is incomplete." }
  )

  // A token must be confirmed once: a second request finds the email already
  // verified and would not log anyone in. React runs effects twice in
  // development, so the guard is a ref, not effect cleanup.
  const startedToken = useRef<string | null>(null)

  useEffect(() => {
    if (!token || startedToken.current === token) return
    startedToken.current = token

    const verify = async () => {
      const { error } = await authClient.verifyEmail({ query: { token } })

      if (error) {
        setState({
          status: "error",
          message:
            "This verification link is invalid or has expired. Log in to get a new one."
        })
        return
      }

      const { data: session } = await authClient.getSession()

      if (!session) {
        // The email was already verified (the link was opened before), so
        // there was nothing to confirm and nobody was logged in.
        setState({ status: "verified" })
        return
      }

      setState({ status: "signedIn" })
      // A full page load, so every part of the app starts from the new login.
      window.location.replace(resolveDestination(callbackURL))
    }

    verify().catch(() => {
      // Allow another attempt: nothing reached the server.
      startedToken.current = null
      setState({
        status: "error",
        message:
          "We could not reach the server. Check your connection and open the link again."
      })
    })
  }, [authClient, callbackURL, token])

  const signInHref = `${basePaths.auth}/${viewPaths.auth.signIn}`

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          {state.status === "verifying" && "Verifying your email"}
          {state.status === "signedIn" && "Email verified"}
          {state.status === "verified" && "Email already verified"}
          {state.status === "error" && "We could not verify your email"}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {state.status === "verifying" && (
          <p
            className="flex items-center gap-2 text-muted-foreground text-sm"
            role="status"
          >
            <Spinner />
            One moment.
          </p>
        )}

        {state.status === "signedIn" && (
          <p
            className="flex items-center gap-2 text-muted-foreground text-sm"
            role="status"
          >
            <Spinner />
            You are logged in. Taking you to your account.
          </p>
        )}

        {state.status === "verified" && (
          <p className="text-muted-foreground text-sm">
            This link has already been used. Log in to continue.
          </p>
        )}

        {state.status === "error" && (
          <p className="text-muted-foreground text-sm" role="alert">
            {state.message}
          </p>
        )}

        {(state.status === "verified" || state.status === "error") && (
          <Button nativeButton={false} render={<Link href={signInHref} />}>
            {localization.auth.signIn}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
