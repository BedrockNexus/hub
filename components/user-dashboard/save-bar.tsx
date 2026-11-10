'use client'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * The save control of every listing settings page. It stays out of the way
 * until something changes, then sticks to the bottom of the screen so Save is
 * always in reach on long pages. Put it last inside the form: its Save button
 * submits the form.
 */
export function SaveBar({
	dirty,
	isSubmitting,
	canSave = true,
	blockedMessage = 'Fix the highlighted fields to save',
	onDiscard,
}: {
	/** Something differs from what is saved. */
	dirty: boolean
	isSubmitting: boolean
	/** False while the changes cannot be saved yet (invalid, locked, …). */
	canSave?: boolean
	/** Shown instead of "unsaved changes" when `canSave` is false. */
	blockedMessage?: string
	/** Puts the saved values back. Leave out when there is nothing to undo. */
	onDiscard?: () => void
}) {
	if (!(dirty || isSubmitting)) {
		return null
	}
	const blocked = !(canSave || isSubmitting)
	return (
		<section
			aria-label="Unsaved changes"
			className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-lg border border-foreground/15 bg-popover/95 px-4 py-3 shadow-black/40 shadow-xl backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:pl-5"
		>
			<p
				aria-live="polite"
				className={
					blocked
						? 'text-muted-foreground text-sm'
						: 'font-medium text-sm'
				}
			>
				{blocked ? blockedMessage : 'You have unsaved changes'}
			</p>
			<div className="flex gap-2">
				{onDiscard ? (
					<Button
						className="flex-1 sm:flex-none"
						disabled={isSubmitting}
						onClick={onDiscard}
						type="button"
						variant="outline"
					>
						Discard
					</Button>
				) : null}
				<Button
					className="flex-1 sm:flex-none"
					disabled={blocked || isSubmitting}
					type="submit"
				>
					{isSubmitting ? (
						<>
							<Spinner className="size-4" />
							Saving...
						</>
					) : (
						'Save changes'
					)}
				</Button>
			</div>
		</section>
	)
}
