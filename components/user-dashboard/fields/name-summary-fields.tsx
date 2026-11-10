'use client'

import {
	type Control,
	Controller,
	type FieldValues,
	type Path,
	useWatch,
} from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { OwnerField } from '@/components/user-dashboard/fields/owner-field'

const SUMMARY_MAX = 150

/**
 * Owner, name and one-line summary: the Basics of every listing's General
 * page. The owner picker only appears for members of an organization.
 */
export function NameSummaryFields<T extends FieldValues>({
	control,
	summaryName,
	namePlaceholder,
	summaryPlaceholder,
	disabled,
	showOwner = true,
}: {
	control: Control<T>
	/** The form's summary field (`summary` or `smallDescription`). */
	summaryName: Path<T>
	namePlaceholder?: string
	summaryPlaceholder?: string
	disabled?: boolean
	/** False where the owner cannot change (e.g. the admin view). */
	showOwner?: boolean
}) {
	const summary = useWatch({ control, name: summaryName }) as
		| string
		| undefined
	return (
		<>
			{showOwner ? (
				<Controller
					control={control}
					name={'organizationId' as Path<T>}
					render={({ field }) => (
						<OwnerField
							onChange={field.onChange}
							value={field.value || undefined}
						/>
					)}
				/>
			) : null}
			<Controller
				control={control}
				name={'name' as Path<T>}
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<FieldLabel htmlFor="name">Name</FieldLabel>
						<Input
							{...field}
							aria-invalid={fieldState.invalid}
							autoComplete="off"
							disabled={disabled}
							id="name"
							placeholder={namePlaceholder}
						/>
						<FieldError errors={[fieldState.error]} />
					</Field>
				)}
			/>
			<Controller
				control={control}
				name={summaryName}
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid}>
						<div className="flex items-baseline justify-between gap-3">
							<FieldLabel htmlFor={summaryName}>
								One-line summary
							</FieldLabel>
							<span
								aria-hidden
								className="text-muted-foreground text-xs tabular-nums"
							>
								{summary?.length ?? 0} / {SUMMARY_MAX}
							</span>
						</div>
						<Textarea
							{...field}
							aria-invalid={fieldState.invalid}
							className="resize-none"
							disabled={disabled}
							id={summaryName}
							maxLength={SUMMARY_MAX}
							placeholder={summaryPlaceholder}
							rows={2}
						/>
						<FieldError errors={[fieldState.error]} />
					</Field>
				)}
			/>
		</>
	)
}
