"use client"

import { useAuthPlugin } from "@better-auth-ui/react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { twoFactorPlugin } from "@/lib/two-factor-plugin"
import { BackupCodes } from "./backup-codes"

/**
 * Backup codes from turning two-factor on, waiting to be saved.
 *
 * Turning two-factor on replaces the session, and the dashboard re-renders
 * its pages while Convex confirms the new one, which would close a dialog
 * holding the codes. Keeping them here, in memory only, lets the codes be
 * shown again once the page is back. They are never written anywhere.
 */
let pendingCodes: string[] | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function showNewBackupCodes(codes: string[]) {
  pendingCodes = codes
  emit()
}

function clearNewBackupCodes() {
  pendingCodes = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Shows the codes from `showNewBackupCodes` until the creator closes it. */
export function NewBackupCodesDialog() {
  const codes = useSyncExternalStore(
    subscribe,
    () => pendingCodes,
    () => null
  )
  const { localization: twoFactorLocalization } = useAuthPlugin(twoFactorPlugin)

  return (
    <Dialog
      open={!!codes}
      onOpenChange={(open) => {
        if (!open) clearNewBackupCodes()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{twoFactorLocalization.backupCodes}</DialogTitle>
          <DialogDescription>
            {twoFactorLocalization.twoFactorEnabled}.
          </DialogDescription>
        </DialogHeader>

        {codes ? <BackupCodes codes={codes} /> : null}

        <DialogFooter>
          <Button type="button" onClick={clearNewBackupCodes}>
            {twoFactorLocalization.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
