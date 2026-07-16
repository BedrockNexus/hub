'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
import { ProjectBasicFields } from '@/components/user-dashboard/projects/fields/project-basic-fields'
import {
	createProjectCategoryToggler,
	ProjectCategoryPicker,
} from '@/components/user-dashboard/projects/fields/project-category-picker'
import { ProjectLinksFields } from '@/components/user-dashboard/projects/fields/project-links-fields'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	PROJECT_FORM_DEFAULTS,
	type ProjectFormData,
	projectFormSchema,
} from '@/lib/schemas/projects'

const STEPS = [
	{
		value: 'core',
		title: 'Core Info',
		description: 'Type, details, and categories',
	},
	{
		value: 'details',
		title: 'Links',
		description: 'Project resources',
	},
] as const

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

export function AddProjectForm() {
	const router = useRouter()
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Convex
	const categories = useQuery(api.functions.projects.categories.list, {})
	const createContent = useMutation(api.functions.projects.projects.create)

	const form = useForm<ProjectFormData>({
		// Project schema unions/coercions can infer a slightly wider resolver type.
		// Keep explicit cast so field components stay strongly typed to ProjectFormData.
		resolver: zodResolver(
			projectFormSchema,
		) as unknown as Resolver<ProjectFormData>,
		defaultValues: PROJECT_FORM_DEFAULTS,
		mode: 'onChange',
	})
	useUnsavedChangesWarning(form.formState.isDirty && !isSubmitting)

	const toggleCategory = createProjectCategoryToggler(
		() => form.getValues('categoryIds'),
		form.setValue,
	)

	const getStepFields = (stepValue: string): (keyof ProjectFormData)[] => {
		switch (stepValue) {
			case 'core':
				return ['type', 'name', 'summary', 'description', 'categoryIds']
			case 'details':
				return [
					'sourceUrl',
					'websiteUrl',
					'issueTrackerUrl',
					'wikiUrl',
					'discordUrl',
					'donationUrl',
				]
			default:
				return []
		}
	}

	const handleValidate = async (
		nextValue: string,
		direction: 'next' | 'prev',
	): Promise<boolean> => {
		if (direction === 'prev') {
			return true
		}

		const nextIndex = STEPS.findIndex((s) => s.value === nextValue)
		if (nextIndex <= 0) {
			return true
		}

		const currentStep = STEPS[nextIndex - 1]
		const fields = getStepFields(currentStep.value)
		return await form.trigger(fields)
	}

	const onSubmit = async (data: ProjectFormData) => {
		setIsSubmitting(true)
		try {
			const ownerType: 'user' | 'organization' = data.organizationId
				? 'organization'
				: 'user'
			// ownerId is required by the mutation args, but ignored for user-owned projects.
			const ownerId = data.organizationId ?? '__self__'

			const project = await createContent({
				type: data.type,
				name: data.name,
				summary: data.summary,
				description: data.description,
				categoryIds: data.categoryIds as Id<'projectCategories'>[],
				sourceUrl: data.sourceUrl || undefined,
				websiteUrl: data.websiteUrl || undefined,
				issueTrackerUrl: data.issueTrackerUrl || undefined,
				wikiUrl: data.wikiUrl || undefined,
				discordUrl: data.discordUrl || undefined,
				donationUrl: data.donationUrl || undefined,
				ownerType: ownerType as 'user' | 'organization',
				ownerId,
			})

			toast.success('Project draft created')
			router.push(`/dashboard/projects/${project.slug}/edit`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to create project',
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
						Create New Project
					</h1>
					<p className="text-muted-foreground text-sm">
						Share your Minecraft Bedrock project with the community
					</p>
				</div>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit)}>
				<Stepper
					className="gap-8"
					defaultValue="core"
					disabled={isSubmitting}
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
									<ProjectBasicFields
										control={form.control}
									/>
								</FieldGroup>
								<p className="rounded-lg border bg-muted/40 p-4 text-muted-foreground text-sm">
									Project icons are uploaded after the draft
									is created so files can be stored under the
									final project folder.
								</p>
							</div>

							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Categories
								</h3>
								<ProjectCategoryPicker
									categories={categories}
									control={form.control}
									onToggle={toggleCategory}
									watch={form.watch}
								/>
							</div>
						</div>
					</StepperContent>

					<StepperContent value="details">
						<div className="space-y-6">
							<p className="text-muted-foreground text-sm">
								Optional step. You can add these now or update
								later.
							</p>
							<div className="space-y-4">
								<h3 className="font-semibold text-base">
									Links
								</h3>
								<FieldGroup>
									<ProjectLinksFields
										control={form.control}
									/>
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
