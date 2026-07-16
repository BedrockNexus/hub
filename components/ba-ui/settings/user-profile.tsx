"use client"

import {
  type AdditionalFieldValue,
  parseAdditionalFieldValue
} from "@better-auth-ui/core"
import {
  type UsernameAuthClient,
  useAuth,
  useSession,
  useUpdateUser
} from "@better-auth-ui/react"
import type { SyntheticEvent } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { AdditionalField } from "@/components/ba-ui/auth/additional-field"
import { ChangeAvatar } from "@/components/ba-ui/settings/change-avatar"

export type UserProfileProps = {
  className?: string
}

/**
 * Render a profile card that lets the authenticated user view and update their display name, username, and avatar.
 *
 * @param className - Optional additional CSS class names applied to the card container
 * @returns A JSX element containing the profile card with avatar upload and editable name/username fields
 */
export function UserProfile({ className }: UserProfileProps) {
  const { additionalFields, authClient, localization } = useAuth()
  const { data: session } = useSession(authClient as UsernameAuthClient)

  const { mutate: updateUser, isPending } = useUpdateUser(authClient, {
    onSuccess: () => toast.success(localization.settings.profileUpdatedSuccess)
  })

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const usernameFromForm = formData.get("username")
    const sessionUsername =
      ((session?.user as Record<string, unknown> | undefined)?.username as
        | string
        | undefined) ?? ""
    const username =
      typeof usernameFromForm === "string" && usernameFromForm.trim().length > 0
        ? usernameFromForm.trim()
        : sessionUsername.trim()

    const additionalFieldValues: Record<string, unknown> = {}

    for (const field of additionalFields ?? []) {
      if (field.profile === false || field.readOnly) continue
      const value = parseAdditionalFieldValue(
        field,
        formData.get(field.name) as string | null
      )

      if (field.validate) {
        try {
          await field.validate(value)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error))
          return
        }
      }

      // `null` = explicit clear (forward to backend); `undefined` = omitted.
      if (value !== undefined) {
        additionalFieldValues[field.name] = value
      }
    }

    updateUser({
      name: username,
      ...additionalFieldValues
    })
  }

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">
        {localization.settings.userProfile}
      </h2>

      <form onSubmit={handleSubmit}>
        <Card className={cn(className)}>
          <CardContent className="flex flex-col gap-6">
            <ChangeAvatar />

            {additionalFields?.map((field) => {
              if (field.profile === false) return null

              if (!session) {
                if (field.inputType === "hidden") {
                  return null
                }

                return (
                  <Skeleton key={field.name}>
                    <Input className="invisible" />
                  </Skeleton>
                )
              }

              const value = (session.user as Record<string, unknown>)[
                field.name
              ]

              // Re-mount when the session value loads so the field's
              // uncontrolled `defaultValue` reflects the latest data.
              const key = `${field.name}:${
                value instanceof Date
                  ? value.toISOString()
                  : String(value ?? "")
              }`

              return (
                <AdditionalField
                  key={key}
                  name={field.name}
                  field={{
                    ...field,
                    // `defaultValue` is sign-up-only; on the profile we
                    // always seed from the session.
                    defaultValue: value as AdditionalFieldValue | null
                  }}
                  isPending={isPending}
                />
              )
            })}
          </CardContent>

          <CardFooter>
            <Button type="submit" size="sm" disabled={isPending || !session}>
              {isPending && <Spinner />}

              {localization.settings.saveChanges}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
