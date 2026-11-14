'use client'

import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { api } from '@/convex/_generated/api'
import { userFacingError } from '@/lib/user-facing-error'

type Kind =
	| 'release'
	| 'listing'
	| 'dependency_breaking'
	| 'server_offline'
	| 'server_online'
type Digest = 'off' | 'daily' | 'weekly'

const KINDS: { value: Kind; label: string; description: string }[] = [
	{
		value: 'release',
		label: 'New releases',
		description:
			'A new version of something you follow, or by a creator you follow.',
	},
	{
		value: 'listing',
		label: 'New listings',
		description:
			'A creator or organization you follow publishes something new.',
	},
	{
		value: 'dependency_breaking',
		label: 'A dependency breaks compatibility',
		description:
			'Something your add-on or pack depends on releases breaking changes.',
	},
	{
		value: 'server_offline',
		label: 'Your server goes offline',
		description: 'When a server you manage stops answering for a while.',
	},
	{
		value: 'server_online',
		label: 'Your server is back online',
		description: 'When it starts answering again after being offline.',
	},
]

const DIGESTS: { value: Digest; label: string; description: string }[] = [
	{ value: 'off', label: 'Off', description: 'No digest emails.' },
	{
		value: 'daily',
		label: 'Daily',
		description: 'One email a day with anything new, around 15:00 UTC.',
	},
	{
		value: 'weekly',
		label: 'Weekly',
		description: 'One email every Monday with anything new.',
	},
]

export default function NotificationSettingsPage() {
	const saved = useQuery(
		api.functions.social.notifications.getMyPreferences,
		{},
	)
	const save = useMutation(
		api.functions.social.notifications.updateMyPreferences,
	)
	const [disabled, setDisabled] = useState<Kind[]>([])
	const [digest, setDigest] = useState<Digest>('off')
	const [instant, setInstant] = useState(true)
	const [pending, setPending] = useState(false)

	useEffect(() => {
		if (!saved) {
			return
		}
		setDisabled(saved.disabledKinds)
		setDigest(saved.digest)
		setInstant(saved.instantAlertEmails)
	}, [saved])

	if (saved === undefined) {
		return <Skeleton className="h-96" />
	}

	const dirty =
		digest !== saved.digest ||
		instant !== saved.instantAlertEmails ||
		disabled.length !== saved.disabledKinds.length ||
		disabled.some((kind) => !saved.disabledKinds.includes(kind))

	const onSave = async () => {
		setPending(true)
		try {
			await save({
				disabledKinds: disabled,
				digest,
				instantAlertEmails: instant,
			})
			toast.success('Notification settings saved')
		} catch (error) {
			toast.error(userFacingError(error, 'Could not save your settings'))
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>On BedrockNexus</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						{KINDS.map((kind) => (
							<Field key={kind.value} orientation="horizontal">
								<FieldContent>
									<FieldLabel htmlFor={`kind-${kind.value}`}>
										{kind.label}
									</FieldLabel>
									<FieldDescription>
										{kind.description}
									</FieldDescription>
								</FieldContent>
								<Switch
									checked={!disabled.includes(kind.value)}
									id={`kind-${kind.value}`}
									onCheckedChange={(checked) =>
										setDisabled((current) =>
											checked
												? current.filter(
														(value) =>
															value !==
															kind.value,
													)
												: [...current, kind.value],
										)
									}
								/>
							</Field>
						))}
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>By email</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<FieldSet>
							<FieldLegend variant="label">Digest</FieldLegend>
							<FieldDescription>
								A summary of unread notifications. Nothing is
								sent when there is nothing new.
							</FieldDescription>
							<RadioGroup
								onValueChange={(value) =>
									setDigest(value as Digest)
								}
								value={digest}
							>
								{DIGESTS.map((option) => (
									<FieldLabel
										htmlFor={`digest-${option.value}`}
										key={option.value}
									>
										<Field orientation="horizontal">
											<RadioGroupItem
												id={`digest-${option.value}`}
												value={option.value}
											/>
											<FieldContent>
												<FieldTitle>
													{option.label}
												</FieldTitle>
												<FieldDescription>
													{option.description}
												</FieldDescription>
											</FieldContent>
										</Field>
									</FieldLabel>
								))}
							</RadioGroup>
						</FieldSet>
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel htmlFor="instant-alerts">
									Server alerts right away
								</FieldLabel>
								<FieldDescription>
									Email the moment a server you manage goes
									offline or comes back, instead of waiting
									for the digest.
								</FieldDescription>
							</FieldContent>
							<Switch
								checked={instant}
								id="instant-alerts"
								onCheckedChange={setInstant}
							/>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					disabled={!dirty || pending}
					onClick={onSave}
					type="button"
				>
					Save changes
				</Button>
			</div>
		</div>
	)
}
