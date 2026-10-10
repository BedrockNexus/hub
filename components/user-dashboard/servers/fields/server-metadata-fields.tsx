'use client'

import { useQuery } from 'convex/react'
import { type Control, Controller } from 'react-hook-form'
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
} from '@/components/ui/combobox'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@/components/ui/field'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { api } from '@/convex/_generated/api'
import {
	SERVER_LANGUAGE_OPTIONS,
	SERVER_REGION_OPTIONS,
	type ServerFormData,
} from '@/lib/schemas/server'

interface ServerMetadataFieldsProps {
	control: Control<ServerFormData>
	disabled?: boolean
}

const EMPTY_REGION_VALUE = 'none'
const EMPTY_SOFTWARE_VALUE = 'none'

export function ServerMetadataFields({
	control,
	disabled,
}: ServerMetadataFieldsProps) {
	const activeGameVersions = useQuery(
		api.functions.site.gameVersions.listActive,
	)
	const activeGameVersionValues = (activeGameVersions ?? []).map(
		(version: { version: string }) => version.version,
	)
	const software = useQuery(api.functions.servers.software.listEnabled)

	return (
		<>
			<Controller
				control={control}
				name="region"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="region">Region</FieldLabel>
						<FieldDescription>
							Where this server is primarily hosted or operated
						</FieldDescription>
						<Select
							onValueChange={(value) =>
								field.onChange(
									value === EMPTY_REGION_VALUE ? '' : value,
								)
							}
							value={field.value || EMPTY_REGION_VALUE}
						>
							<SelectTrigger disabled={disabled} id="region">
								<SelectValue placeholder="Select a region" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={EMPTY_REGION_VALUE}>
									No region selected
								</SelectItem>
								{SERVER_REGION_OPTIONS.map((region) => (
									<SelectItem key={region} value={region}>
										{region}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="softwareId"
				render={({ field, fieldState }) => {
					// Software an admin has since disabled stays selectable on
					// the server that already declared it.
					const isKnown = (software ?? []).some(
						(item) => item._id === field.value,
					)
					return (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor="softwareId">
								Server software
							</FieldLabel>
							<FieldDescription>
								What your server runs. Shown on your listing as
								declared by you
							</FieldDescription>
							<Select
								onValueChange={(value) =>
									field.onChange(
										value === EMPTY_SOFTWARE_VALUE
											? ''
											: value,
									)
								}
								value={field.value || EMPTY_SOFTWARE_VALUE}
							>
								<SelectTrigger
									disabled={disabled || !software}
									id="softwareId"
								>
									<SelectValue placeholder="Select server software">
										{(value: string) =>
											(software ?? []).find(
												(item) => item._id === value,
											)?.name ??
											(value === EMPTY_SOFTWARE_VALUE
												? 'Not specified'
												: 'Current selection')
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={EMPTY_SOFTWARE_VALUE}>
										Not specified
									</SelectItem>
									{field.value && !isKnown ? (
										<SelectItem value={field.value}>
											Current selection
										</SelectItem>
									) : null}
									{(software ?? []).map((item) => (
										<SelectItem
											key={item._id}
											value={item._id}
										>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{fieldState.error && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)
				}}
			/>

			<Controller
				control={control}
				name="language"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="language">Languages</FieldLabel>
						<FieldDescription>
							Select every language supported by the server
							community
						</FieldDescription>
						<Combobox
							disabled={disabled}
							items={[...SERVER_LANGUAGE_OPTIONS]}
							multiple
							onValueChange={field.onChange}
							value={field.value ?? []}
						>
							<ComboboxChips aria-invalid={fieldState.invalid}>
								<ComboboxValue>
									{(field.value ?? []).map((language) => (
										<ComboboxChip key={language}>
											{language}
										</ComboboxChip>
									))}
								</ComboboxValue>
								<ComboboxChipsInput
									disabled={disabled}
									id="language"
									placeholder="Add language"
								/>
							</ComboboxChips>
							<ComboboxContent>
								<ComboboxEmpty>
									No languages found.
								</ComboboxEmpty>
								<ComboboxList>
									{(language: string) => (
										<ComboboxItem
											key={language}
											value={language}
										>
											{language}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>

			<Controller
				control={control}
				name="gameVersions"
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="gameVersions">
							Game Versions
						</FieldLabel>
						<FieldDescription>
							Select the Minecraft Bedrock versions this server
							supports
						</FieldDescription>
						{(() => {
							const gameVersionValues = Array.from(
								new Set([
									...(field.value ?? []),
									...activeGameVersionValues,
								]),
							)

							return (
								<Combobox
									disabled={disabled || !activeGameVersions}
									items={gameVersionValues}
									multiple
									onValueChange={field.onChange}
									value={field.value ?? []}
								>
									<ComboboxChips
										aria-invalid={fieldState.invalid}
									>
										<ComboboxValue>
											{(field.value ?? []).map(
												(version) => (
													<ComboboxChip key={version}>
														{version}
													</ComboboxChip>
												),
											)}
										</ComboboxValue>
										<ComboboxChipsInput
											disabled={
												disabled || !activeGameVersions
											}
											id="gameVersions"
											placeholder="Add game version"
										/>
									</ComboboxChips>
									<ComboboxContent>
										<ComboboxEmpty>
											No versions found.
										</ComboboxEmpty>
										<ComboboxList>
											{(version: string) => (
												<ComboboxItem
													key={version}
													value={version}
												>
													{version}
												</ComboboxItem>
											)}
										</ComboboxList>
									</ComboboxContent>
								</Combobox>
							)
						})()}
						{fieldState.error && (
							<FieldError errors={[fieldState.error]} />
						)}
					</Field>
				)}
			/>
		</>
	)
}
