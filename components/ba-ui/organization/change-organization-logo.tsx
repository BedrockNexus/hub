"use client"

import {
  type OrganizationAuthClient,
  useActiveOrganization,
  useAuth,
  useAuthPlugin,
  useUpdateOrganization
} from "@better-auth-ui/react"
import { Trash2, Upload } from "@/components/ui/icons"
import { type ChangeEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationLogoUpload } from "@/hooks/use-picture-upload"
import { organizationPlugin } from "@/lib/organization-plugin"
import { cn } from "@/lib/utils"
import { OrganizationLogo } from "./organization-logo"

export type ChangeOrganizationLogoProps = {
  className?: string
}

export function ChangeOrganizationLogo({
  className
}: ChangeOrganizationLogoProps) {
  const { authClient } = useAuth()
  const { logo, localization: organizationLocalization } =
    useAuthPlugin(organizationPlugin)

  const { data: activeOrganization, isPending: activeOrganizationPending } =
    useActiveOrganization(authClient as OrganizationAuthClient)

  const { mutate: updateOrganization, isPending: updatePending } =
    useUpdateOrganization(authClient as OrganizationAuthClient)

  const uploadLogo = useOrganizationLogoUpload()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isPending = updatePending || isUploading || isDeleting

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeOrganization) return

    e.target.value = ""

    setIsUploading(true)

    try {
      const resized =
        (await logo.resize?.(file, logo.size, logo.extension)) || file

      // Stored in R2; `organization.logo` holds the CDN URL, never the image.
      const image = await uploadLogo(activeOrganization.id, resized)

      updateOrganization(
        { data: { logo: image } },
        {
          onSuccess: () =>
            toast.success(organizationLocalization.logoChangedSuccess),
          onSettled: () => setIsUploading(false)
        }
      )
    } catch (error) {
      setIsUploading(false)
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  async function handleDelete() {
    const currentLogo = activeOrganization?.logo

    updateOrganization(
      { data: { logo: "" } },
      {
        onSuccess: async () => {
          if (!currentLogo) {
            toast.success(organizationLocalization.logoDeletedSuccess)
            return
          }

          setIsDeleting(true)
          try {
            await logo.delete?.(currentLogo)
            toast.success(organizationLocalization.logoDeletedSuccess)
          } catch (error) {
            if (error instanceof Error) {
              toast.error(error.message)
            }
          } finally {
            setIsDeleting(false)
          }
        }
      }
    )
  }

  if (!logo.enabled) {
    return null
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label aria-disabled={!activeOrganization}>
        {organizationLocalization.logo}
      </Label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-auto w-auto rounded-full p-0"
          disabled={!activeOrganization || isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <OrganizationLogo
            size="lg"
            isPending={activeOrganizationPending}
            organization={activeOrganization}
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" disabled={!activeOrganization || isPending} size="sm" variant="secondary" />}>{isPending && <Spinner />}{organizationLocalization.changeLogo}</DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="min-w-fit">
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
              <Upload className="text-muted-foreground" />

              {organizationLocalization.uploadLogo}
            </DropdownMenuItem>

            <DropdownMenuItem
              disabled={!activeOrganization?.logo}
              onSelect={handleDelete}
              variant="destructive"
            >
              <Trash2 />

              {organizationLocalization.deleteLogo}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
