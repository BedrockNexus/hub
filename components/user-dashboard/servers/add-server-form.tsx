'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ServerBasicFields } from '@/components/user-dashboard/servers/fields/server-basic-fields'
import {
	createCategoryToggler,
	ServerCategoryPicker,
} from '@/components/user-dashboard/servers/fields/server-category-picker'
import { ServerConnectionFields } from '@/components/user-dashboard/servers/fields/server-connection-fields'
import { ServerLinksFields } from '@/components/user-dashboard/servers/fields/server-links-fields'
import { ServerMetadataFields } from '@/components/user-dashboard/servers/fields/server-metadata-fields'
import {
	ServerOwnershipVerification,
	type VerifiedServerTarget,
} from '@/components/user-dashboard/servers/server-ownership-verification'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	SERVER_FORM_DEFAULTS,
	type ServerFormData,
	serverFormSchema,
} from '@/lib/schemas/server'

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
	const [verifiedTarget, setVerifiedTarget] =
		useState<VerifiedServerTarget | null>(null)
	const [isVerificationBusy, setIsVerificationBusy] = useState(false)

	// Convex
	const categories = useQuery(api.functions.servers.categories.list, {})
	const createServer = useMutation(api.functions.servers.servers.create)

	const form = useForm<ServerFormData>({
		resolver: zodResolver(
			serverFormSchema,
		) as unknown as Resolver<ServerFormData>,
		defaultValues: SERVER_FORM_DEFAULTS,
		mode: 'onChange',
	})
	const hasUnsavedChanges = form.formState.isDirty

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

	const watchedIpAddress = form.watch('ipAddress')
	const watchedPort = Number(form.watch('port'))
	const isVerified =
		!!verifiedTarget &&
		verifiedTarget.ipAddress === watchedIpAddress &&
		verifiedTarget.port === watchedPort

	useEffect(() => {
		if (
			verifiedTarget &&
			(verifiedTarget.ipAddress !== watchedIpAddress ||
				verifiedTarget.port !== watchedPort)
		) {
			setVerifiedTarget(null)
			toast.info('Server address changed. Please verify it again.')
		}
	}, [verifiedTarget, watchedIpAddress, watchedPort])

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
					disabled={isSubmitting || isVerificationBusy}
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
						<ServerOwnershipVerification
							ipAddress={watchedIpAddress}
							onBusyChange={setIsVerificationBusy}
							onVerified={setVerifiedTarget}
							port={watchedPort}
							verified={isVerified}
						/>
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
								<p className="rounded-md border bg-muted/40 p-4 text-muted-foreground text-sm">
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
