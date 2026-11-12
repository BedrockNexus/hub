'use client'

import { useMutation, useQuery } from 'convex/react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useState } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useMinute } from '@/hooks/use-minute'
import { queueRowHref } from '@/lib/moderation-queue'
import { userFacingError } from '@/lib/user-facing-error'
import { cn } from '@/lib/utils'

export type ReviewContentId =
	| Id<'projects'>
	| Id<'plugins'>
	| Id<'servers'>
	| Id<'projectVersions'>

export function RailCard({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<section className={cn('rounded-lg border bg-card', className)}>
			{children}
		</section>
	)
}

/** Who holds a pending review, and claiming or releasing it. */
export function useReviewAssignment({
	contentId,
	revision,
	pending,
}: {
	contentId: ReviewContentId
	revision: number
	pending: boolean
}) {
	const assignment = useQuery(api.functions.moderation.work.assignment, {
		contentId,
		revision,
	})
	const claim = useMutation(api.functions.moderation.work.claim)
	const [busy, setBusy] = useState(false)
	const toggle = async () => {
		setBusy(true)
		try {
			await claim({ contentId, revision, release: assignment?.mine })
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update the claim'))
		} finally {
			setBusy(false)
		}
	}
	const other = Boolean(assignment?.assignee && !assignment.mine)
	return {
		pending,
		assignment,
		busy,
		toggle,
		/** Why decisions are unavailable, if they are. */
		locked: other
			? `${assignment?.assignee} is reviewing this. Only they can decide until they release it or their claim runs out.`
			: undefined,
	}
}

export function ClaimCard({
	review,
}: {
	review: ReturnType<typeof useReviewAssignment>
}) {
	const now = useMinute()
	const { assignment, pending, busy, toggle } = review
	if (!pending) {
		return null
	}
	if (!assignment) {
		return <Skeleton className="h-[70px] w-full rounded-lg" />
	}
	let title: string
	let detail: string
	let action: ReactNode = null
	if (assignment.mine) {
		// `now` is rounded down to the minute, so cap at the full hold.
		const left = Math.min(
			30,
			Math.max(
				1,
				Math.ceil(((assignment.expiresAt ?? now) - now) / 60_000),
			),
		)
		title = 'You are reviewing this'
		detail = `Held for you for ${left} more ${left === 1 ? 'minute' : 'minutes'}`
		action = (
			<Button disabled={busy} onClick={toggle} variant="outline">
				Release
			</Button>
		)
	} else if (assignment.assignee) {
		title = `${assignment.assignee} is reviewing this`
		detail = 'You can look, but only they can decide for now.'
	} else {
		title = 'Nobody is reviewing this'
		detail = 'Claim it so other moderators skip it.'
		action = (
			<Button disabled={busy} onClick={toggle} variant="outline">
				Claim
			</Button>
		)
	}
	return (
		<RailCard className="flex items-center justify-between gap-3 px-4 py-3.5">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="flex items-center gap-2 font-semibold text-sm">
					{assignment.mine ? (
						<span
							aria-hidden
							className="size-2 shrink-0 rounded-full bg-primary"
						/>
					) : null}
					{title}
				</span>
				<span className="text-[13px] text-muted-foreground">
					{detail}
				</span>
			</div>
			{action}
		</RailCard>
	)
}

/** Opens the oldest unclaimed submission other than `currentId`. */
export function NextReviewButton({ currentId }: { currentId: string }) {
	const queue = useQuery(api.functions.moderation.work.queue, {})
	const claim = useMutation(api.functions.moderation.work.claim)
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	const next = queue?.rows.find(
		(row) => row.id !== currentId && !row.assignee,
	)
	if (!next) {
		return (
			<Link className={buttonVariants()} href="/moderation">
				Back to the queue
			</Link>
		)
	}
	return (
		<Button
			disabled={busy}
			onClick={async () => {
				setBusy(true)
				try {
					await claim({
						contentId: next.id as ReviewContentId,
						revision: next.revision,
					})
				} catch {
					// Someone else took it; open it anyway.
				}
				router.push(queueRowHref(next) as Route)
			}}
		>
			Next review: {next.name}
		</Button>
	)
}

export interface DecisionOption {
	id: string
	label: string
	hint: string
	tone: 'approve' | 'changes' | 'reject'
	/** The confirm button's label once this is chosen. */
	submit: string
	message: 'required' | 'optional' | 'none'
	/** Why it cannot be chosen now. */
	unavailable?: string
	/** What the panel says after it was sent. */
	done: string
}

const TONE = {
	approve: 'has-data-checked:border-online',
	changes: 'has-data-checked:border-primary',
	reject: 'has-data-checked:border-destructive',
}

function decisionBlocker(
	locked: string | undefined,
	picked: DecisionOption | undefined,
	message: string,
) {
	if (locked) {
		return locked
	}
	if (!picked) {
		return 'Pick a decision.'
	}
	if (picked.unavailable) {
		return picked.unavailable
	}
	if (picked.message === 'required' && !message.trim()) {
		return 'Tell the creator what to change.'
	}
	return undefined
}

/**
 * The choices for a submission, the message to its creator, and one button
 * that sends them. Shown beside every tab, so the decision is never more
 * than a click away.
 */
export function DecisionPanel({
	title = 'Decision',
	options,
	onSubmit,
	locked,
	currentId,
	revision,
}: {
	title?: string
	options: DecisionOption[]
	onSubmit: (id: string, message: string) => Promise<void>
	locked?: string
	currentId: string
	/** A new revision clears an unsent choice; a sent decision stays shown. */
	revision?: number
}) {
	const id = useId()
	const [pickedId, setPickedId] = useState<string>()
	const [message, setMessage] = useState('')
	const [sending, setSending] = useState(false)
	const [done, setDone] = useState<string>()
	const [seenRevision, setSeenRevision] = useState(revision)
	if (revision !== seenRevision) {
		setSeenRevision(revision)
		if (!(done || sending)) {
			setPickedId(undefined)
			setMessage('')
		}
	}
	const picked = options.find((option) => option.id === pickedId)
	const blocker = decisionBlocker(locked, picked, message)

	if (done) {
		return (
			<RailCard className="flex flex-col gap-2.5 px-4 py-5">
				<h2 className="font-bold font-display text-[17px]">Done</h2>
				<p className="text-muted-foreground text-sm">{done}</p>
				<NextReviewButton currentId={currentId} />
			</RailCard>
		)
	}
	if (!options.length) {
		return null
	}

	const send = async () => {
		if (!picked || blocker) {
			return
		}
		setSending(true)
		try {
			await onSubmit(picked.id, message.trim())
			setDone(picked.done)
			setMessage('')
		} catch (error) {
			toast.error(userFacingError(error, 'Could not send the decision'))
		} finally {
			setSending(false)
		}
	}

	return (
		<RailCard>
			<fieldset className="flex flex-col gap-2.5 p-4">
				<legend className="float-left mb-2.5 font-bold font-display text-[17px]">
					{title}
				</legend>
				<RadioGroup
					className="clear-both gap-2.5"
					disabled={sending || Boolean(locked)}
					onValueChange={(value) => setPickedId(String(value))}
					value={pickedId ?? null}
				>
					{options.map((option) => (
						<label
							className={cn(
								'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 hover:border-foreground/30 has-data-checked:bg-muted/40',
								TONE[option.tone],
							)}
							htmlFor={`${id}-${option.id}`}
							key={option.id}
						>
							<RadioGroupItem
								className="mt-0.5"
								id={`${id}-${option.id}`}
								value={option.id}
							/>
							<span className="flex flex-col gap-0.5">
								<span className="font-semibold text-sm">
									{option.label}
								</span>
								<span className="text-[13px] text-muted-foreground leading-snug">
									{option.unavailable ?? option.hint}
								</span>
							</span>
						</label>
					))}
				</RadioGroup>
				{picked && picked.message !== 'none' ? (
					<>
						<label
							className="mt-1.5 flex justify-between font-medium text-sm"
							htmlFor={`${id}-message`}
						>
							Message to the creator
							<span className="font-normal text-muted-foreground">
								{picked.message === 'required'
									? 'Required'
									: 'Optional'}
							</span>
						</label>
						<Textarea
							className="min-h-28"
							disabled={sending}
							id={`${id}-message`}
							maxLength={500}
							onChange={(event) => setMessage(event.target.value)}
							placeholder={
								picked.message === 'required'
									? 'What needs to change, and where.'
									: 'Anything the creator should know.'
							}
							value={message}
						/>
						<span className="self-end text-muted-foreground text-xs">
							{message.length}/500
						</span>
					</>
				) : null}
				<Button
					className="mt-1 h-11"
					disabled={Boolean(blocker) || sending}
					onClick={send}
				>
					{sending ? <Spinner className="size-4" /> : null}
					{picked?.submit ?? 'Send decision'}
				</Button>
				{blocker ? (
					<p className="text-center text-[13px] text-muted-foreground">
						{blocker}
					</p>
				) : null}
			</fieldset>
		</RailCard>
	)
}

/** The feedback the creator was last given. */
export function FeedbackCard({
	title = 'Last feedback',
	text,
}: {
	title?: string
	text?: string
}) {
	if (!text?.trim()) {
		return null
	}
	return (
		<RailCard className="flex flex-col gap-2 px-4 py-3.5">
			<h2 className="font-semibold text-sm">{title}</h2>
			<p className="whitespace-pre-wrap text-muted-foreground text-sm">
				{text}
			</p>
		</RailCard>
	)
}

export function FactsCard({
	rows,
}: {
	rows: [label: string, value: ReactNode][]
}) {
	const shown = rows.filter(
		([, value]) => value !== undefined && value !== '',
	)
	if (!shown.length) {
		return null
	}
	return (
		<RailCard className="px-4 py-1">
			<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 text-sm">
				{shown.map(([label, value], index) => (
					<div className="contents" key={label}>
						<dt
							className={cn(
								'py-2.5 text-muted-foreground',
								index < shown.length - 1 && 'border-b',
							)}
						>
							{label}
						</dt>
						<dd
							className={cn(
								'break-words py-2.5 text-right',
								index < shown.length - 1 && 'border-b',
							)}
						>
							{value}
						</dd>
					</div>
				))}
			</dl>
		</RailCard>
	)
}
