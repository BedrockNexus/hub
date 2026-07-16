"use client"

import {
  type MultiSessionAuthClient,
  useAuth,
  useSession,
  useSetActiveSession
} from "@better-auth-ui/react"
import {
  Login01Icon,
  Logout01Icon,
  Settings01Icon,
  UnfoldMoreIcon,
  UserAdd01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type ComponentType,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenuGroup,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/ba-ui/user/user-avatar"
import { UserView } from "@/components/ba-ui/user/user-view"

/** Auth states a `UserButton` link can be visible in. */
export type UserButtonLinkVisibility =
  | "authenticated"
  | "unauthenticated"
  | "always"

/** A simple link entry rendered as a `DropdownMenuItem` in the `UserButton` menu. */
export type UserButtonLink = {
  /** Visible label. */
  label: ReactNode
  /** Destination URL. */
  href: string
  /** Optional leading icon. Sized/coloured to match built-in items. */
  icon?: ReactNode
  /** Forwarded to the underlying `DropdownMenuItem`. */
  variant?: "default" | "destructive"
  /**
   * When this link is visible based on auth state.
   * @default "always"
   */
  visibility?: UserButtonLinkVisibility
}

export type UserButtonProps = {
  className?: string
  align?: "center" | "end" | "start" | undefined
  sideOffset?: number
  size?: "default" | "icon"
  variant?:
    | "default"
    | "destructive"
    | "ghost"
    | "link"
    | "outline"
    | "secondary"
  /** Additional menu entries rendered above the built-in items. */
  links?: (UserButtonLink | ReactElement)[]
  /** Hide the built-in "Settings" link. Useful when replacing it via `links`. */
  hideSettings?: boolean
}

function renderUserLink(
  link: UserButtonLink | ReactElement,
  Link: ComponentType<{ href: string; children?: ReactNode }>,
  fallbackKey: string
): ReactNode {
  if (isValidElement(link)) return link

  const { label, href, icon, variant } = link
  return (
    <DropdownMenuItem key={fallbackKey} variant={variant} render={<Link href={href} />}>{icon}{label}</DropdownMenuItem>
  )
}

/**
 * Render a user dropdown button that shows user info, settings, theme controls, and authentication actions.
 *
 * Includes user profile, settings link, optional multi-session account switching, theme picker,
 * and sign-in/sign-up/sign-out actions depending on authentication state.
 *
 * @param className - Additional CSS classes applied to the button trigger
 * @param align - Alignment of the dropdown menu relative to the trigger
 * @param sideOffset - Offset between the trigger and the dropdown menu
 * @param size - "icon" renders only the avatar; "default" renders a full button with label and chevron
 * @param variant - Visual variant of the trigger button
 * @param links - Additional menu entries rendered above the built-in items
 * @param hideSettings - Hide the built-in "Settings" link
 * @returns The dropdown menu component with user actions
 */
export function UserButton({
  className,
  align,
  sideOffset,
  size = "default",
  variant = "ghost",
  links,
  hideSettings = false
}: UserButtonProps) {
  const { authClient, basePaths, viewPaths, localization, plugins, Link } =
    useAuth()

  const { isPending: settingActiveSession } = useSetActiveSession(
    authClient as MultiSessionAuthClient
  )
  const { data: session, isPending: sessionPending } = useSession(authClient)

  const userLinks = links?.flatMap((link, index) => {
    if (!isValidElement(link)) {
      const visibility = link.visibility ?? "always"
      if (visibility === "authenticated" && !session) return []
      if (visibility === "unauthenticated" && session) return []
    }
    return [renderUserLink(link, Link, `user-button-link-${index.toString()}`)]
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          size === "icon" ? (
            <Button
              variant={variant}
              className={cn("rounded-full", className)}
              size="icon"
            >
              <UserAvatar />
            </Button>
          ) : (
            <Button
              variant={variant}
              className={cn("py-2.5 h-auto font-normal", className)}
              size="lg"
            >
              {session || sessionPending || settingActiveSession ? (
                <UserView isPending={!!settingActiveSession} />
              ) : (
                <>
                  <UserAvatar />

                  <div className="grid flex-1 text-left text-sm leading-tight">
                    {localization.auth.account}
                  </div>
                </>
              )}

              <HugeiconsIcon className="ml-auto" icon={UnfoldMoreIcon} />
            </Button>
          )
        }
      />

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-40 md:min-w-56 max-w-[48svw]"
        sideOffset={sideOffset}
        align={align}
      >
        {session && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-sm font-normal">
                <UserView />
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
          </>
        )}

        {session ? (
          <>
            {userLinks}

            {!hideSettings && (
              <DropdownMenuItem render={<Link href={`${basePaths.settings}/${viewPaths.settings.account}`} />}><HugeiconsIcon className="text-muted-foreground" icon={Settings01Icon} />{localization.settings.settings}</DropdownMenuItem>
            )}

            {plugins.flatMap((plugin) =>
              plugin.userMenuItems?.map((Item, index) => (
                <Item key={`${plugin.id}-${index.toString()}`} />
              ))
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem render={<Link href={`${basePaths.auth}/${viewPaths.auth.signOut}`} />}><HugeiconsIcon className="text-muted-foreground" icon={Logout01Icon} />{localization.auth.signOut}</DropdownMenuItem>
          </>
        ) : (
          <>
            {userLinks}

            <DropdownMenuItem render={<Link href={`${basePaths.auth}/${viewPaths.auth.signIn}`} />}><HugeiconsIcon className="text-muted-foreground" icon={Login01Icon} />{localization.auth.signIn}</DropdownMenuItem>

            <DropdownMenuItem render={<Link href={`${basePaths.auth}/${viewPaths.auth.signUp}`} />}><HugeiconsIcon className="text-muted-foreground" icon={UserAdd01Icon} />{localization.auth.signUp}</DropdownMenuItem>

            {plugins.flatMap((plugin) =>
              plugin.userMenuItems?.map((Item, index) => (
                <Item key={`${plugin.id}-${index.toString()}`} />
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
