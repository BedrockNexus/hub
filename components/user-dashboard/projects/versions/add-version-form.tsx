'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
	CheckmarkCircle02Icon,
	InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
	Faceted,
	FacetedBadgeList,
	FacetedContent,
	FacetedEmpty,
	FacetedGroup,
	FacetedInput,
	FacetedItem,
	FacetedList,
	FacetedTrigger,
} from '@/components/dice-ui/faceted'
import { RichTextEditor } from '@/components/editor/rich-text-editor'
import { Button } from '@/components/ui/button'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { VersionFileUpload } from '@/components/uploads/version-file-upload'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import {
	getProjectArtifactPolicy,
	normalizeProjectType,
	type StoredProjectType,
} from '@/lib/project-artifacts'
import {
	VERSION_FORM_DEFAULTS,
	type VersionFormData,
	versionFormSchema,
} from '@/lib/schemas/projects'

interface AddVersionFormProps {
	projectId: Id<'projects'>
	projectSlug: string
	projectType: StoredProjectType
}

export function AddVersionForm({
	projectId,
	projectSlug,
	projectType,
}: AddVersionFormProps) {
	const router = useRouter()
	const createVersion = useMutation(api.functions.projects.versions.create)
	const activeGameVersions = useQuery(
		api.functions.site.gameVersions.listActive,
	)

	const [isSubmitting, setIsSubmitting] = useState(false)

	const {
		control,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isDirty },
	} = useForm<VersionFormData>({
		resolver: zodResolver(versionFormSchema),
		defaultValues: VERSION_FORM_DEFAULTS,
	})

	const versionValue = watch('version')
	const uploadId = watch('uploadId')
	const artifactPolicy = getProjectArtifactPolicy(projectType)
	useUnsavedChangesWarning((isDirty || !!uploadId) && !isSubmitting)

	const onSubmit = async (data: VersionFormData) => {
		setIsSubmitting(true)
		try {
			const result = await createVersion({
				projectId,
				version: data.version,
				changelog: data.changelog || undefined,
				uploadId: data.uploadId as Id<'projectArtifactUploads'>,
				skinModel: data.skinModel,
				gameVersions:
					data.gameVersions.length > 0
						? data.gameVersions
						: undefined,
			})
			if (!result.ok) {
				throw new Error(result.error)
			}
			toast.success(
				`Version ${data.version} uploaded and queued for validation`,
			)
			router.push(`/dashboard/projects/${projectSlug}/edit/versions`)
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : 'Failed to upload version',
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
			<FieldGroup>
				{/* Version string */}
				<Controller
					control={control}
					name="version"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="version">Version *</FieldLabel>
							<FieldDescription>
								Use a semver-style string, e.g.{' '}
								<code>1.0.0</code> or <code>2.3.1-beta</code>
							</FieldDescription>
							<Input
								disabled={isSubmitting}
								id="version"
								placeholder="1.0.0"
								{...field}
							/>
							{fieldState.error && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>

				{/* Version file */}
				<Field data-invalid={!!errors.uploadId}>
					<FieldLabel>Version File *</FieldLabel>
					<FieldDescription>
						{artifactPolicy.requirement}
					</FieldDescription>
					<VersionFileUpload
						disabled={isSubmitting || !versionValue}
						onUploadComplete={(id, _key, fileName, fileSize) => {
							setValue('uploadId', id, { shouldValidate: true })
							setValue('fileName', fileName)
							setValue('fileSize', fileSize)
						}}
						onUploadRemoved={() => {
							setValue('uploadId', '', { shouldValidate: true })
							setValue('fileName', '')
							setValue('fileSize', 0)
						}}
						projectId={projectId}
						projectType={projectType}
						version={versionValue || 'draft'}
					/>
					{!versionValue && (
						<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
							<HugeiconsIcon
								className="size-3.5"
								icon={InformationCircleIcon}
							/>
							Enter a version string above before uploading
						</p>
					)}
					{errors.uploadId && (
						<FieldError errors={[errors.uploadId]} />
					)}
				</Field>

				{normalizeProjectType(projectType) === 'skin' ? (
					<Controller
						control={control}
						name="skinModel"
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel>Player Model *</FieldLabel>
								<FieldDescription>
									Choose the arm style this skin was designed
									for.
								</FieldDescription>
								<Select
									onValueChange={field.onChange}
									value={field.value}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select a player model" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="classic">
											Classic (Steve)
										</SelectItem>
										<SelectItem value="slim">
											Slim (Alex)
										</SelectItem>
									</SelectContent>
								</Select>
								{fieldState.error ? (
									<FieldError errors={[fieldState.error]} />
								) : null}
							</Field>
						)}
					/>
				) : null}

				{/* Game versions */}
				<Controller
					control={control}
					name="gameVersions"
					render={({ field, fieldState }) => {
						const options = (activeGameVersions ?? []).map(
							(gv: { version: string }) => ({
								label: gv.version,
								value: gv.version,
							}),
						)
						return (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel>
									Compatible Game Versions
								</FieldLabel>
								<FieldDescription>
									Select the Minecraft Bedrock versions this
									release supports.
								</FieldDescription>
								<Faceted
									multiple
									onValueChange={field.onChange}
									value={field.value}
								>
									<FacetedTrigger
										render={
											<button
												className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
												disabled={
													isSubmitting ||
													!activeGameVersions
												}
												type="button"
											/>
										}
									>
										<FacetedBadgeList
											options={options}
											placeholder="Select game versions..."
										/>
									</FacetedTrigger>
									<FacetedContent>
										<FacetedInput placeholder="Search versions..." />
										<FacetedList>
											<FacetedEmpty>
												No versions found.
											</FacetedEmpty>
											<FacetedGroup>
												{options.map(
													(opt: {
														label: string
														value: string
													}) => (
														<FacetedItem
															key={opt.value}
															value={opt.value}
														>
															{opt.label}
														</FacetedItem>
													),
												)}
											</FacetedGroup>
										</FacetedList>
									</FacetedContent>
								</Faceted>
								{fieldState.error && (
									<FieldError errors={[fieldState.error]} />
								)}
							</Field>
						)
					}}
				/>

				{/* Changelog */}
				<Controller
					control={control}
					name="changelog"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="changelog">
								Changelog
							</FieldLabel>
							<FieldDescription>
								What changed in this version? Supports rich
								text.
							</FieldDescription>
							<div id="changelog">
								<RichTextEditor
									disabled={isSubmitting}
									onChange={field.onChange}
									placeholder="Describe what changed in this release..."
									value={field.value}
								/>
							</div>
							{fieldState.error && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			</FieldGroup>

			<div className="flex justify-end gap-3">
				<Button
					disabled={isSubmitting}
					onClick={() => router.back()}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
				<Button disabled={isSubmitting || !uploadId} type="submit">
					{isSubmitting ? (
						<>
							<Spinner className="size-4" />
							Publishing...
						</>
					) : (
						<>
							<HugeiconsIcon
								className="size-4"
								icon={CheckmarkCircle02Icon}
							/>
							Publish Version
						</>
					)}
				</Button>
			</div>
		</form>
	)
}
