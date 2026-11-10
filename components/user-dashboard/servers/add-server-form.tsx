'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from 'convex/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
	CreateListingFooter,
	CreateListingShell,
} from '@/components/user-dashboard/create/create-listing-shell'
import { OwnerField } from '@/components/user-dashboard/fields/owner-field'
import {
	ServerOwnershipVerification,
	type VerifiedServerTarget,
} from '@/components/user-dashboard/servers/server-ownership-verification'
import { api } from '@/convex/_generated/api'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { serverFormSchema } from '@/lib/schemas/server'
import { serverReference } from '@/lib/server-routes'
import { userFacingError } from '@/lib/user-facing-error'

const createSchema = serverFormSchema.pick({
	organizationId: true,
	name: true,
	smallDescription: true,
	ipAddress: true,
	port: true,
})

interface CreateFormData {
	organizationId?: string
	name: string
	smallDescription: string
	ipAddress: string
	port: number
}

const SUMMARY_MAX = 150

/**
 * Creates a server draft in two steps: the name, summary and address, then
 * proof that you run the server. Everything else (description, categories,
 * branding, links) is added from the server's dashboard.
 */
export function AddServerForm({ showPlugins }: { showPlugins: boolean }) {
	const router = useRouter()
	const [step, setStep] = useState<'details' | 'verify'>('details')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [verifiedTarget, setVerifiedTarget] =
		useState<VerifiedServerTarget | null>(null)
	const [isVerificationBusy, setIsVerificationBusy] = useState(false)
	const createServer = useMutation(api.functions.servers.servers.create)

	const form = useForm<CreateFormData>({
		resolver: zodResolver(createSchema) as never,
		defaultValues: {
			organizationId: undefined,
			name: '',
			smallDescription: '',
			ipAddress: '',
			port: 19_132,
		},
		mode: 'onTouched',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	const [summary, ipAddress, rawPort] = useWatch({
		control: form.control,
		name: ['smallDescription', 'ipAddress', 'port'],
	})
	const port = Number(rawPort)
	const isVerified =
		!!verifiedTarget &&
		verifiedTarget.ipAddress === ipAddress &&
		verifiedTarget.port === port

	// A proof only covers the address it was made for.
	useEffect(() => {
		if (
			verifiedTarget &&
			(verifiedTarget.ipAddress !== ipAddress ||
				verifiedTarget.port !== port)
		) {
			setVerifiedTarget(null)
		}
	}, [verifiedTarget, ipAddress, port])

	const goToVerify = async () => {
		const valid = await form.trigger([
			'name',
			'smallDescription',
			'ipAddress',
			'port',
		])
		if (valid) {
			setStep('verify')
			window.scrollTo({ top: 0 })
		}
	}

	const onSubmit = async (data: CreateFormData) => {
		if (!isVerified) {
			toast.error('Verify this server address before creating it')
			return
		}
		setIsSubmitting(true)
		try {
			await createServer({
				name: data.name.trim(),
				smallDescription: data.smallDescription.trim(),
				ipAddress: data.ipAddress.trim(),
				port: Number(data.port),
				organizationId: data.organizationId || undefined,
			})
			form.reset(data)
			toast.success('Server draft created')
			router.push(
				`/dashboard/servers/${encodeURIComponent(
					serverReference({
						ipAddress: data.ipAddress.trim(),
						port: Number(data.port),
					}),
				)}`,
			)
		} catch (error) {
			toast.error(userFacingError(error, 'Failed to create server draft'))
			setIsSubmitting(false)
		}
	}

	if (step === 'verify') {
		return (
			<CreateListingShell
				eyebrow="Step 2 of 2"
				hideKinds
				intro="This stops people listing servers that are not theirs. It takes a minute, and you can remove the code afterwards."
				kind="server"
				showPlugins={showPlugins}
				title="Prove you own the server"
			>
				<form
					className="flex flex-col gap-9"
					noValidate
					onSubmit={form.handleSubmit(onSubmit)}
				>
					<ServerOwnershipVerification
						ipAddress={ipAddress}
						onBusyChange={setIsVerificationBusy}
						onVerified={setVerifiedTarget}
						port={port}
						verified={isVerified}
					/>
					<CreateListingFooter
						note={
							isVerified
								? 'Verified. Create the draft to continue.'
								: 'Verify the server to create the draft.'
						}
					>
						<Button
							disabled={isSubmitting || isVerificationBusy}
							onClick={() => setStep('details')}
							type="button"
							variant="ghost"
						>
							Back
						</Button>
						<Button
							disabled={
								!isVerified ||
								isSubmitting ||
								isVerificationBusy
							}
							type="submit"
						>
							{isSubmitting ? (
								<>
									<Spinner className="size-4" />
									Creating...
								</>
							) : (
								'Create draft'
							)}
						</Button>
					</CreateListingFooter>
				</form>
			</CreateListingShell>
		)
	}

	return (
		<CreateListingShell kind="server" showPlugins={showPlugins}>
			<form
				className="flex flex-col gap-9"
				noValidate
				onSubmit={async (event) => {
					event.preventDefault()
					await goToVerify()
				}}
			>
				<FieldGroup className="gap-5">
					<Controller
						control={form.control}
						name="organizationId"
						render={({ field }) => (
							<OwnerField
								onChange={field.onChange}
								value={field.value}
							/>
						)}
					/>
					<Controller
						control={form.control}
						name="name"
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor="name">Name</FieldLabel>
								<Input
									{...field}
									aria-invalid={fieldState.invalid}
									autoComplete="off"
									className="h-11"
									id="name"
									placeholder="Skyblock Isles"
								/>
								<FieldError errors={[fieldState.error]} />
							</Field>
						)}
					/>
					<Controller
						control={form.control}
						name="smallDescription"
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<div className="flex items-baseline justify-between gap-3">
									<FieldLabel htmlFor="smallDescription">
										One-line summary
									</FieldLabel>
									<span
										aria-hidden
										className="text-muted-foreground text-xs tabular-nums"
									>
										{summary.length} / {SUMMARY_MAX}
									</span>
								</div>
								<Textarea
									{...field}
									aria-invalid={fieldState.invalid}
									className="min-h-22 resize-none"
									id="smallDescription"
									maxLength={SUMMARY_MAX}
									placeholder="Skyblock with weekly island contests."
									rows={3}
								/>
								<FieldError errors={[fieldState.error]} />
							</Field>
						)}
					/>
					<div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
						<Controller
							control={form.control}
							name="ipAddress"
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor="ipAddress">
										Server address
									</FieldLabel>
									<Input
										{...field}
										aria-invalid={fieldState.invalid}
										autoCapitalize="none"
										autoComplete="off"
										className="h-11"
										id="ipAddress"
										placeholder="play.example.net"
										spellCheck={false}
									/>
									<FieldError errors={[fieldState.error]} />
								</Field>
							)}
						/>
						<Controller
							control={form.control}
							name="port"
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor="port">Port</FieldLabel>
									<Input
										{...field}
										aria-invalid={fieldState.invalid}
										className="h-11"
										id="port"
										inputMode="numeric"
										onChange={(event) =>
											field.onChange(
												event.target.value === ''
													? ''
													: event.target
															.valueAsNumber,
											)
										}
										type="number"
										value={field.value ?? ''}
									/>
									<FieldError errors={[fieldState.error]} />
								</Field>
							)}
						/>
					</div>
				</FieldGroup>

				<CreateListingFooter note="Step 1 of 2. Next you prove you own the server.">
					<Link
						className={buttonVariants({ variant: 'ghost' })}
						href="/dashboard/servers"
					>
						Cancel
					</Link>
					<Button type="submit">Continue</Button>
				</CreateListingFooter>
			</form>
		</CreateListingShell>
	)
}
