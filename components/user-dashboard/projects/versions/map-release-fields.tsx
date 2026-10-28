'use client'

import {
	Controller,
	type UseFormReturn,
	useFieldArray,
	useWatch,
} from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { VersionFormData } from '@/lib/schemas/projects'

export function MapReleaseFields({
	form,
	disabled,
}: {
	form: UseFormReturn<VersionFormData>
	disabled: boolean
}) {
	const packs = useFieldArray({
		control: form.control,
		name: 'releaseMetadata.bundledPacks',
	})
	const experimentsRequired = form.watch(
		'releaseMetadata.experiments.required',
	)
	const currentPacks = useWatch({
		control: form.control,
		name: 'releaseMetadata.bundledPacks',
	})
	const error = form.formState.errors.releaseMetadata
	return (
		<fieldset
			className="min-w-0 space-y-5 rounded-md border p-4"
			disabled={disabled}
		>
			<legend className="px-2 font-semibold">
				Map gameplay and requirements
			</legend>
			<p className="text-muted-foreground text-sm">
				These details belong to this release. Changes after submission
				require a replacement release.
			</p>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="map-min-players">
						Minimum players
					</FieldLabel>
					<Input
						id="map-min-players"
						max={1000}
						min={1}
						required
						type="number"
						{...form.register('releaseMetadata.players.min', {
							valueAsNumber: true,
						})}
					/>
					<FieldError errors={[error?.players?.min]} />
				</Field>
				<Field>
					<FieldLabel htmlFor="map-max-players">
						Maximum players
					</FieldLabel>
					<Input
						id="map-max-players"
						max={1000}
						min={1}
						required
						type="number"
						{...form.register('releaseMetadata.players.max', {
							valueAsNumber: true,
						})}
					/>
					<FieldError
						errors={[error?.players?.max, error?.players]}
					/>
				</Field>
			</div>
			<Field>
				<FieldLabel htmlFor="map-gameplay">How to play</FieldLabel>
				<Textarea
					id="map-gameplay"
					maxLength={2000}
					minLength={20}
					required
					{...form.register('releaseMetadata.gameplay')}
				/>
				<FieldDescription>
					Explain the objective, starting point and gameplay.
				</FieldDescription>
				<FieldError errors={[error?.gameplay]} />
			</Field>
			<Field>
				<FieldLabel htmlFor="map-installation">
					Installation and setup
				</FieldLabel>
				<Textarea
					id="map-installation"
					maxLength={4000}
					minLength={20}
					required
					{...form.register('releaseMetadata.installation')}
				/>
				<FieldDescription>
					Include setup steps for this world and any device
					limitations.
				</FieldDescription>
				<FieldError errors={[error?.installation]} />
			</Field>
			{(
				[
					[
						'releaseMetadata.requirements.commandBlocksRequired',
						'Command blocks required',
					],
					[
						'releaseMetadata.requirements.cheatsRequired',
						'Cheats required',
					],
					[
						'releaseMetadata.experiments.required',
						'Experiments required',
					],
				] as const
			).map(([name, label]) => (
				<Controller
					control={form.control}
					key={name}
					name={name}
					render={({ field }) => (
						<div className="flex items-center justify-between gap-3">
							<FieldLabel htmlFor={name}>{label}</FieldLabel>
							<Switch
								checked={field.value ?? false}
								disabled={disabled}
								id={name}
								onCheckedChange={(value) => {
									field.onChange(value)
									if (
										name ===
											'releaseMetadata.experiments.required' &&
										!value
									) {
										form.setValue(
											'releaseMetadata.experiments.names',
											[],
											{
												shouldDirty: true,
												shouldValidate: true,
											},
										)
									}
								}}
							/>
						</div>
					)}
				/>
			))}
			{experimentsRequired ? (
				<Controller
					control={form.control}
					name="releaseMetadata.experiments.names"
					render={({ field }) => (
						<Field>
							<FieldLabel htmlFor="map-experiments">
								Required experiment names
							</FieldLabel>
							<Input
								id="map-experiments"
								onChange={(event) =>
									field.onChange(
										event.target.value
											.split(',')
											.map((name) => name.trim()),
									)
								}
								value={field.value?.join(', ') ?? ''}
							/>
							<FieldDescription>
								Separate names with commas. List the experiments
								enabled in this export.
							</FieldDescription>
							<FieldError errors={[error?.experiments?.names]} />
						</Field>
					)}
				/>
			) : null}
			<Field>
				<FieldLabel htmlFor="map-notes">
					Additional requirements
				</FieldLabel>
				<Textarea
					id="map-notes"
					maxLength={2000}
					{...form.register('releaseMetadata.requirements.notes')}
				/>
				<FieldError errors={[error?.requirements?.notes]} />
			</Field>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="font-medium">Bundled packs</h3>
				<Button
					disabled={disabled || packs.fields.length >= 64}
					onClick={() =>
						packs.append({
							kind: 'behavior',
							name: '',
							uuid: '',
							version: [1, 0, 0],
						})
					}
					type="button"
					variant="outline"
				>
					Add bundled pack
				</Button>
			</div>
			<p className="text-muted-foreground text-sm">
				List every included pack using its manifest UUID and version.
				All required packs must be inside the world export.
			</p>
			{packs.fields.map((pack, index) => (
				<div
					className="min-w-0 space-y-3 rounded-md border p-3"
					key={pack.id}
				>
					<Field>
						<FieldLabel htmlFor={`pack-kind-${pack.id}`}>
							Pack type
						</FieldLabel>
						<select
							className="h-9 rounded-md border bg-background px-3 text-sm"
							id={`pack-kind-${pack.id}`}
							{...form.register(
								`releaseMetadata.bundledPacks.${index}.kind`,
							)}
						>
							<option value="behavior">Behavior pack</option>
							<option value="resource">Resource pack</option>
						</select>
					</Field>
					<Field>
						<FieldLabel htmlFor={`pack-name-${pack.id}`}>
							Pack name
						</FieldLabel>
						<Input
							id={`pack-name-${pack.id}`}
							maxLength={80}
							required
							{...form.register(
								`releaseMetadata.bundledPacks.${index}.name`,
							)}
						/>
						<FieldError
							errors={[error?.bundledPacks?.[index]?.name]}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`pack-uuid-${pack.id}`}>
							Header UUID
						</FieldLabel>
						<Input
							id={`pack-uuid-${pack.id}`}
							required
							{...form.register(
								`releaseMetadata.bundledPacks.${index}.uuid`,
							)}
						/>
						<FieldError
							errors={[error?.bundledPacks?.[index]?.uuid]}
						/>
					</Field>
					<div className="grid grid-cols-3 gap-2">
						{([0, 1, 2] as const).map((part) => (
							<Field key={part}>
								<FieldLabel
									htmlFor={`pack-version-${pack.id}-${part}`}
								>
									{['Major', 'Minor', 'Patch'][part]}
								</FieldLabel>
								<Input
									id={`pack-version-${pack.id}-${part}`}
									max={2_147_483_647}
									min={0}
									required
									type="number"
									{...form.register(
										`releaseMetadata.bundledPacks.${index}.version.${part}`,
										{ valueAsNumber: true },
									)}
								/>
							</Field>
						))}
					</div>
					<FieldError
						errors={[error?.bundledPacks?.[index]?.version]}
					/>
					<Field>
						<FieldLabel htmlFor={`pack-credit-${pack.id}`}>
							Credit or redistribution permission
						</FieldLabel>
						<Input
							id={`pack-credit-${pack.id}`}
							maxLength={500}
							{...form.register(
								`releaseMetadata.bundledPacks.${index}.credit`,
							)}
						/>
					</Field>
					<Button
						aria-label={`Remove ${currentPacks?.[index]?.name || 'pack'}`}
						disabled={disabled}
						onClick={() => packs.remove(index)}
						type="button"
						variant="outline"
					>
						Remove pack
					</Button>
				</div>
			))}
			<FieldError
				errors={[error?.bundledPacks?.root, error?.bundledPacks, error]}
			/>
		</fieldset>
	)
}
