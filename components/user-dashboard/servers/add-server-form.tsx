'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
	CheckmarkCircle02Icon,
	CheckmarkSquare02Icon,
	Copy01Icon,
	RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
	Stepper,
	StepperContent,
	StepperDescription,
	StepperIndicator,
	StepperItem,
	StepperList,
	StepperNext,
	StepperPrev,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
	useStepper,
} from '@/components/dice-ui/stepper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServerBasicFields } from '@/components/user-dashboard/servers/fields/server-basic-fields'
import {
	createCategoryToggler,
	ServerCategoryPicker,
} from '@/components/user-dashboard/servers/fields/server-category-picker'
import { ServerConnectionFields } from '@/components/user-dashboard/servers/fields/server-connection-fields'
import { ServerLinksFields } from '@/components/user-dashboard/servers/fields/server-links-fields'
import { ServerMetadataFields } from '@/components/user-dashboard/servers/fields/server-metadata-fields'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	SERVER_FORM_DEFAULTS,
	type ServerFormData,
	serverFormSchema,
} from '@/lib/schemas/server'

type VerificationMethod = 'dns_txt' | 'motd_token'

const VERIFICATION_PREFIX = 'bedrocknexus-verify='

// Steps configuration
const STEPS = [
	{
		value: 'core',
		title: 'Core Info',
		description: 'Name, connection, and categories',
	},
	{ value: 'verify', title: 'Verify', description: 'Prove server ownership' },
	{
		value: 'details',
		title: 'Optional Details',
		description: 'Branding and links you can add later',
	},
] as const

// Navigation component that uses stepper context
function StepperNavigation({ isSubmitting }: { isSubmitting: boolean }) {
	const currentValue = useStepper((state) => state.value)
	const steps = useStepper((state) => state.steps)

	const stepKeys = Array.from(steps.keys())
	const currentIndex = currentValue ? stepKeys.indexOf(currentValue) : 0
	const isLastStep = currentIndex === stepKeys.length - 1

	return (
		<div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
			<StepperPrev asChild disabled={isSubmitting}>
				<Button
					className="w-full sm:w-auto"
					type="button"
					variant="outline"
				>
					Previous
				</Button>
			</StepperPrev>
			<span className="text-center text-muted-foreground text-sm sm:col-start-2">
				Step {currentIndex + 1} of {stepKeys.length}
			</span>
			{isLastStep ? (
				<Button
					className="w-full sm:col-start-3 sm:ml-auto sm:w-auto"
					disabled={isSubmitting}
					type="submit"
				>
					{isSubmitting ? (
						<>
							<Spinner className="size-4" />
							Creating...
						</>
					) : (
						<>
							<HugeiconsIcon
								className="size-4"
								icon={CheckmarkCircle02Icon}
							/>
							Create Draft
						</>
					)}
				</Button>
			) : (
				<StepperNext asChild disabled={isSubmitting}>
					<Button
						className="w-full sm:col-start-3 sm:ml-auto sm:w-auto"
						type="button"
					>
						Next
					</Button>
				</StepperNext>
			)}
		</div>
	)
}

export function AddServerForm() {
	const router = useRouter()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [verificationCode, setVerificationCode] = useState<string | null>(
		null,
	)
	const [verificationMethod, setVerificationMethod] =
		useState<VerificationMethod>('motd_token')
	const [isVerified, setIsVerified] = useState(false)
	const [verifiedTarget, setVerifiedTarget] = useState<{
		ipAddress: string
		port: number
	} | null>(null)
	const [isVerifying, setIsVerifying] = useState(false)
	const [isGeneratingCode, setIsGeneratingCode] = useState(false)

	// Convex
	const categories = useQuery(api.functions.servers.categories.list, {})
	const createServer = useMutation(api.functions.servers.servers.create)
	const generateVerificationCode = useAction(
		api.functions.servers.verification.generateCode,
	)
	const verifyServerOwnership = useAction(
		api.functions.servers.verification.verifyOwnership,
	)

	const form = useForm<ServerFormData>({
		resolver: zodResolver(
			serverFormSchema,
		) as unknown as Resolver<ServerFormData>,
		defaultValues: SERVER_FORM_DEFAULTS,
		mode: 'onChange',
	})
	const hasUnsavedChanges = form.formState.isDirty || !!verificationCode

	useUnsavedChangesWarning(hasUnsavedChanges && !isSubmitting)

	const toggleCategory = createCategoryToggler(
		() => form.getValues('categoryIds'),
		form.setValue,
	)

	// Get fields to validate for step
	const getStepFields = (stepValue: string): (keyof ServerFormData)[] => {
		switch (stepValue) {
			case 'core':
				return [
					'name',
					'smallDescription',
					'ipAddress',
					'port',
					'categoryIds',
				]
			case 'verify':
				return [] // Custom validation
			case 'details':
				return ['website', 'discordUrl', 'storeUrl', 'wikiUrl']
			default:
				return []
		}
	}

	// Generate verification code
	const generateCode = useCallback(async () => {
		setIsGeneratingCode(true)
		try {
			const code = await generateVerificationCode({})
			setVerificationCode(code)
			setIsVerified(false)
			setVerifiedTarget(null)
			return true
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to generate verification code',
			)
			return false
		} finally {
			setIsGeneratingCode(false)
		}
	}, [generateVerificationCode])

	const verifyOwnership = useCallback(async () => {
		const ip = form.getValues('ipAddress')
		const port = Number(form.getValues('port'))
		if (!(ip && verificationCode)) {
			toast.error('Please enter an IP address first')
			return
		}
		if (!(Number.isInteger(port) && port >= 1 && port <= 65_535)) {
			toast.error('Please enter a valid server port')
			return
		}

		setIsVerifying(true)
		try {
			const data = await verifyServerOwnership({
				ipAddress: ip,
				code: verificationCode,
				method: verificationMethod,
				port,
			})

			if (data.verified) {
				setIsVerified(true)
				setVerifiedTarget({ ipAddress: ip, port })
				toast.success('Server ownership verified!')
			} else {
				toast.error(
					data.error ||
						`Verification failed. Check the ${
							verificationMethod === 'dns_txt'
								? 'DNS record'
								: 'server MOTD'
						} and try again.`,
				)
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Verification failed. Please try again.',
			)
		} finally {
			setIsVerifying(false)
		}
	}, [form, verificationCode, verificationMethod, verifyServerOwnership])

	const changeVerificationMethod = (value: string) => {
		if (value !== 'dns_txt' && value !== 'motd_token') {
			return
		}
		setVerificationMethod(value)
		setIsVerified(false)
		setVerifiedTarget(null)
	}

	useEffect(() => {
		const subscription = form.watch((value, { name }) => {
			const isAddressField = name === 'ipAddress' || name === 'port'
			if (!(isAddressField && verifiedTarget)) {
				return
			}

			const nextIp = value.ipAddress
			const nextPort = Number(value.port)
			if (
				nextIp !== verifiedTarget.ipAddress ||
				nextPort !== verifiedTarget.port
			) {
				setIsVerified(false)
				setVerifiedTarget(null)
				toast.info('Server address changed. Please verify it again.')
			}
		})

		return () => subscription.unsubscribe()
	}, [form, verifiedTarget])

	// Copy to clipboard
	const copyToClipboard = useCallback((text: string) => {
		navigator.clipboard.writeText(text)
		toast.success('Copied to clipboard!')
	}, [])

	// Validation handler for stepper navigation
	const handleValidate = async (
		nextValue: string,
		direction: 'next' | 'prev',
	): Promise<boolean> => {
		// Always allow going back
		if (direction === 'prev') {
			return true
		}

		// Find current step index based on next step
		const nextIndex = STEPS.findIndex((s) => s.value === nextValue)
		if (nextIndex <= 0) {
			return true
		}

		const currentStep = STEPS[nextIndex - 1]

		// Special handling for core step -> verify step
		if (currentStep.value === 'core') {
			const fields = getStepFields(currentStep.value)
			const isValid = await form.trigger(fields)
			if (!isValid) {
				return false
			}

			// Generate code if not already generated
			if (!verificationCode) {
				return await generateCode()
			}

			return true
		}

		// Special handling for verify step -> details step
		if (currentStep.value === 'verify') {
			if (!isVerified) {
				toast.error('Please verify server ownership before continuing')
				return false
			}
			return true
		}

		const fields = getStepFields(currentStep.value)
		return await form.trigger(fields)
	}

	const onSubmit = async (data: ServerFormData) => {
		const currentPort = Number(data.port)
		const verificationMatches =
			isVerified &&
			!!verifiedTarget &&
			verifiedTarget.ipAddress === data.ipAddress &&
			verifiedTarget.port === currentPort

		if (!verificationMatches) {
			toast.error('Verify this exact server address before creating it')
			return
		}

		setIsSubmitting(true)
		try {
			await createServer({
				name: data.name,
				smallDescription: data.smallDescription,
				description: data.description || undefined,
				ipAddress: data.ipAddress,
				port: currentPort,
				categoryIds: data.categoryIds as Id<'serverCategories'>[],
				website: data.website || undefined,
				discordUrl: data.discordUrl || undefined,
				storeUrl: data.storeUrl || undefined,
				wikiUrl: data.wikiUrl || undefined,
				region: data.region || undefined,
				language: data.language.length > 0 ? data.language : undefined,
				gameVersions:
					data.gameVersions.length > 0
						? data.gameVersions
						: undefined,
				organizationId: data.organizationId || undefined,
			})

			toast.success('Server draft created!')
			router.push('/dashboard/servers')
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to create server draft',
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div className="space-y-6">
			<div className="mb-8 flex items-center gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="font-bold text-2xl tracking-tight">
						Add New Server
					</h1>
					<p className="text-muted-foreground text-sm">
						Register your Minecraft Bedrock server
					</p>
				</div>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit)}>
				<Stepper
					className="gap-8"
					defaultValue="core"
					disabled={isSubmitting || isGeneratingCode || isVerifying}
					onValidate={handleValidate}
				>
					<StepperList className="overflow-x-auto pb-1">
						{STEPS.map((step) => (
							<StepperItem key={step.value} value={step.value}>
								<StepperTrigger>
									<StepperIndicator />
									<div className="flex flex-col gap-px">
										<StepperTitle>
											{step.title}
										</StepperTitle>
										<StepperDescription>
											{step.description}
										</StepperDescription>
									</div>
								</StepperTrigger>
								<StepperSeparator />
							</StepperItem>
						))}
					</StepperList>
					<StepperContent value="core">
						<div className="space-y-6">
							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Basic Info
								</h3>
								<FieldGroup>
									<ServerBasicFields control={form.control} />
								</FieldGroup>
							</div>

							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Server Details
								</h3>
								<FieldGroup>
									<ServerMetadataFields
										control={form.control}
										disabled={isSubmitting}
									/>
								</FieldGroup>
							</div>

							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Connection
								</h3>
								<FieldGroup>
									<ServerConnectionFields
										control={form.control}
									/>
								</FieldGroup>
							</div>

							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Categories
								</h3>
								<ServerCategoryPicker
									categories={categories}
									control={form.control}
									onToggle={toggleCategory}
									watch={form.watch}
								/>
							</div>
						</div>
					</StepperContent>

					<StepperContent value="verify">
						<div className="space-y-6">
							{verificationCode && (
								<div className="space-y-4 rounded-lg border bg-muted/50 p-6">
									<div className="space-y-3">
										<h3 className="mb-2 font-semibold">
											Verify Server Ownership
										</h3>
										<p className="text-muted-foreground text-sm">
											Choose the method that best fits how
											you manage your server.
										</p>
										<Tabs
											onValueChange={
												changeVerificationMethod
											}
											value={verificationMethod}
										>
											<TabsList className="w-full max-w-sm">
												<TabsTrigger value="motd_token">
													Server MOTD
												</TabsTrigger>
												<TabsTrigger value="dns_txt">
													DNS Record
												</TabsTrigger>
											</TabsList>
										</Tabs>
									</div>

									<div className="space-y-3">
										<div>
											<p className="mb-1 font-medium text-sm">
												{verificationMethod ===
												'motd_token'
													? '1. Add this token anywhere in your server MOTD:'
													: '1. Add this TXT record to your domain:'}
											</p>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
												<code className="min-w-0 flex-1 break-all rounded border bg-background px-3 py-2 font-mono text-sm">
													{VERIFICATION_PREFIX}
													{verificationCode}
												</code>
												<Button
													aria-label="Copy verification token"
													className="self-start sm:self-auto"
													onClick={() =>
														copyToClipboard(
															`${VERIFICATION_PREFIX}${verificationCode}`,
														)
													}
													size="icon"
													type="button"
													variant="outline"
												>
													<HugeiconsIcon
														className="size-4"
														icon={Copy01Icon}
													/>
												</Button>
											</div>
										</div>

										{verificationMethod === 'dns_txt' ? (
											<div>
												<p className="mb-1 font-medium text-sm">
													2. Add the record to this
													hostname:
												</p>
												<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
													<code className="min-w-0 flex-1 break-all rounded border bg-background px-3 py-2 font-mono text-sm">
														{form.watch(
															'ipAddress',
														)}
													</code>
													<Button
														aria-label="Copy server hostname"
														className="self-start sm:self-auto"
														onClick={() =>
															copyToClipboard(
																form.watch(
																	'ipAddress',
																),
															)
														}
														size="icon"
														type="button"
														variant="outline"
													>
														<HugeiconsIcon
															className="size-4"
															icon={Copy01Icon}
														/>
													</Button>
												</div>
											</div>
										) : (
											<p className="text-muted-foreground text-sm">
												2. Save or reload your server
												configuration so the updated
												MOTD is visible at{' '}
												<span className="font-medium text-foreground">
													{form.watch('ipAddress')}:
													{form.watch('port')}
												</span>
												.
											</p>
										)}

										<div className="pt-2">
											<p className="mb-3 text-muted-foreground text-xs">
												{verificationMethod ===
												'dns_txt'
													? 'DNS changes can take a few minutes to propagate. The server must be online and pass the native Bedrock software check.'
													: 'The server must be online. Verification checks both MOTD lines and rejects Java servers using Geyser.'}
											</p>

											<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
												<Button
													className="w-full sm:w-auto"
													disabled={
														isVerifying ||
														isGeneratingCode ||
														isVerified
													}
													onClick={verifyOwnership}
													type="button"
												>
													{(() => {
														if (isVerifying) {
															return (
																<>
																	<Spinner className="size-4" />
																	Verifying...
																</>
															)
														}
														if (isVerified) {
															return (
																<>
																	<HugeiconsIcon
																		className="size-4"
																		icon={
																			CheckmarkSquare02Icon
																		}
																	/>
																	Verified
																</>
															)
														}
														return (
															<>
																<HugeiconsIcon
																	className="size-4"
																	icon={
																		RefreshIcon
																	}
																/>
																Verify Ownership
															</>
														)
													})()}
												</Button>

												{!isVerified && (
													<Button
														className="w-full sm:w-auto"
														disabled={
															isVerifying ||
															isGeneratingCode
														}
														onClick={generateCode}
														type="button"
														variant="ghost"
													>
														{isGeneratingCode ? (
															<>
																<Spinner className="size-4" />
																Generating...
															</>
														) : (
															'Generate New Code'
														)}
													</Button>
												)}
											</div>
										</div>
									</div>
								</div>
							)}

							{isVerified && (
								<Alert>
									<HugeiconsIcon
										className="size-4"
										icon={CheckmarkCircle02Icon}
									/>
									<AlertTitle>Ownership Verified!</AlertTitle>
									<AlertDescription>
										You&apos;ve successfully verified
										ownership of this server. You can now
										continue to the next step.
									</AlertDescription>
								</Alert>
							)}
						</div>
					</StepperContent>

					<StepperContent value="details">
						<div className="space-y-6">
							<p className="text-muted-foreground text-sm">
								This step is optional. You can publish a clean
								draft now and add branding or links later from
								server settings.
							</p>
							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Branding
								</h3>
								<p className="rounded-lg border bg-muted/40 p-4 text-muted-foreground text-sm">
									Branding uploads are available after the
									draft is created so files can be stored
									under the final server folder.
								</p>
							</div>

							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Links
								</h3>
								<FieldGroup>
									<ServerLinksFields control={form.control} />
								</FieldGroup>
							</div>
						</div>
					</StepperContent>

					<StepperNavigation isSubmitting={isSubmitting} />
				</Stepper>
			</form>
		</div>
	)
}
