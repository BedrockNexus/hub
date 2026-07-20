'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Controller, type UseFormReturn, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Field,
	FieldDescription,
	FieldError,
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
import { Switch } from '@/components/ui/switch'
import {
	MAP_GAME_MODE_LABELS,
	MAP_GAME_MODES,
	RESOURCE_PACK_CONTENT_LABELS,
	RESOURCE_PACK_CONTENT_TYPES,
	RESOURCE_PACK_RESOLUTIONS,
	SKIN_CHARACTER_CATEGORIES,
	SKIN_CHARACTER_CATEGORY_LABELS,
} from '@/lib/project-metadata'
import type { ProjectFormData } from '@/lib/schemas/projects'

function BooleanSetting({
	description,
	form,
	label,
	name,
}: {
	description: string
	form: UseFormReturn<ProjectFormData>
	label: string
	name:
		| 'behaviorPackIncluded'
		| 'resourcePackIncluded'
		| 'experimentalFeaturesRequired'
		| 'mapMultiplayerSupport'
}) {
	return (
		<Controller
			control={form.control}
			name={name}
			render={({ field }) => (
				<div className="flex items-start justify-between gap-4 rounded-md border p-4">
					<div className="space-y-1">
						<FieldLabel htmlFor={name}>{label}</FieldLabel>
						<FieldDescription>{description}</FieldDescription>
					</div>
					<Switch
						checked={field.value as boolean}
						id={name}
						onCheckedChange={field.onChange}
					/>
				</div>
			)}
		/>
	)
}

export function ProjectTypeFields({
	form,
}: {
	form: UseFormReturn<ProjectFormData>
}) {
	const type = form.watch('type')
	const dependencies = useFieldArray({
		control: form.control,
		name: 'addonDependencies',
	})

	if (type === 'addon') {
		return (
			<div className="space-y-4">
				<BooleanSetting
					description="The download contains a behavior pack."
					form={form}
					label="Behavior pack included"
					name="behaviorPackIncluded"
				/>
				<BooleanSetting
					description="The download contains a resource pack."
					form={form}
					label="Resource pack included"
					name="resourcePackIncluded"
				/>
				<BooleanSetting
					description="Players must enable experimental features for the addon to work."
					form={form}
					label="Experimental features required"
					name="experimentalFeaturesRequired"
				/>

				<Field>
					<div className="flex items-center justify-between gap-3">
						<div>
							<FieldLabel>Dependencies</FieldLabel>
							<FieldDescription>
								Other packs or projects required by this addon.
							</FieldDescription>
						</div>
						<Button
							onClick={() =>
								dependencies.append({ name: '', url: '' })
							}
							size="sm"
							type="button"
							variant="outline"
						>
							<HugeiconsIcon
								className="size-4"
								icon={Add01Icon}
							/>
							Add
						</Button>
					</div>
					{dependencies.fields.length ? (
						<div className="space-y-3">
							{dependencies.fields.map((dependency, index) => (
								<div
									className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_2.25rem]"
									key={dependency.id}
								>
									<Input
										aria-label="Dependency name"
										placeholder="Dependency name"
										{...form.register(
											`addonDependencies.${index}.name`,
										)}
									/>
									<Input
										aria-label="Dependency URL"
										placeholder="https://... (optional)"
										{...form.register(
											`addonDependencies.${index}.url`,
										)}
									/>
									<Button
										aria-label="Remove dependency"
										onClick={() =>
											dependencies.remove(index)
										}
										size="icon"
										type="button"
										variant="ghost"
									>
										<HugeiconsIcon
											className="size-4"
											icon={Delete02Icon}
										/>
									</Button>
								</div>
							))}
						</div>
					) : null}
					{form.formState.errors.addonDependencies ? (
						<FieldError
							errors={[form.formState.errors.addonDependencies]}
						/>
					) : null}
				</Field>
			</div>
		)
	}

	if (type === 'map') {
		return (
			<div className="space-y-4">
				<Controller
					control={form.control}
					name="mapGameMode"
					render={({ field }) => (
						<Field>
							<FieldLabel>Game mode</FieldLabel>
							<Select
								onValueChange={field.onChange}
								value={field.value}
							>
								<SelectTrigger>
									<SelectValue>
										{MAP_GAME_MODE_LABELS[field.value]}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{MAP_GAME_MODES.map((mode) => (
										<SelectItem key={mode} value={mode}>
											{MAP_GAME_MODE_LABELS[mode]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				/>
				<BooleanSetting
					description="The map is designed to work with multiple players."
					form={form}
					label="Multiplayer support"
					name="mapMultiplayerSupport"
				/>
				<Controller
					control={form.control}
					name="mapEstimatedPlaytimeMinutes"
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="mapEstimatedPlaytimeMinutes">
								Estimated playtime in minutes
							</FieldLabel>
							<FieldDescription>
								Optional for open-ended maps.
							</FieldDescription>
							<Input
								id="mapEstimatedPlaytimeMinutes"
								min={1}
								onChange={(event) =>
									field.onChange(
										event.target.value
											? Number(event.target.value)
											: undefined,
									)
								}
								type="number"
								value={field.value ?? ''}
							/>
							{fieldState.error ? (
								<FieldError errors={[fieldState.error]} />
							) : null}
						</Field>
					)}
				/>
			</div>
		)
	}

	if (type === 'resource_pack') {
		return (
			<div className="space-y-4">
				<Controller
					control={form.control}
					name="resourcePackResolution"
					render={({ field }) => (
						<Field>
							<FieldLabel>Resolution</FieldLabel>
							<Select
								onValueChange={field.onChange}
								value={field.value}
							>
								<SelectTrigger>
									<SelectValue>{field.value}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{RESOURCE_PACK_RESOLUTIONS.map(
										(resolution) => (
											<SelectItem
												key={resolution}
												value={resolution}
											>
												{resolution}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</Field>
					)}
				/>
				<Controller
					control={form.control}
					name="resourcePackContentTypes"
					render={({ field }) => (
						<Field>
							<FieldLabel>Content areas</FieldLabel>
							<div className="grid gap-2 sm:grid-cols-2">
								{RESOURCE_PACK_CONTENT_TYPES.map(
									(contentType) => (
										<label
											className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm"
											htmlFor={`resource-pack-content-${contentType}`}
											key={contentType}
										>
											<Checkbox
												checked={field.value.includes(
													contentType,
												)}
												id={`resource-pack-content-${contentType}`}
												onCheckedChange={(checked) =>
													field.onChange(
														checked
															? [
																	...field.value,
																	contentType,
																]
															: field.value.filter(
																	(value) =>
																		value !==
																		contentType,
																),
													)
												}
											/>
											{
												RESOURCE_PACK_CONTENT_LABELS[
													contentType
												]
											}
										</label>
									),
								)}
							</div>
						</Field>
					)}
				/>
			</div>
		)
	}

	return (
		<Controller
			control={form.control}
			name="skinCharacterCategory"
			render={({ field }) => (
				<Field>
					<FieldLabel>Character category</FieldLabel>
					<Select onValueChange={field.onChange} value={field.value}>
						<SelectTrigger>
							<SelectValue>
								{SKIN_CHARACTER_CATEGORY_LABELS[field.value]}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{SKIN_CHARACTER_CATEGORIES.map((category) => (
								<SelectItem key={category} value={category}>
									{SKIN_CHARACTER_CATEGORY_LABELS[category]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>
						The Classic or Slim player model is selected for each
						release.
					</FieldDescription>
				</Field>
			)}
		/>
	)
}
