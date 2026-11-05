'use client'
import { useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function Filter({
	label,
	value,
	set,
	options,
}: {
	label: string
	value: string
	set: (value: string) => void
	options: string[]
}) {
	return (
		<Select onValueChange={(next) => set(next ?? '')} value={value}>
			<SelectTrigger aria-label={label}>
				<SelectValue>{value || label}</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="">{label}</SelectItem>
				{options.map((option) => (
					<SelectItem key={option} value={option}>
						{option}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
export function ReviewQueue() {
	const [clock, setClock] = useState(() => Date.now())
	useEffect(() => {
		const timer = setInterval(() => setClock(Date.now()), 60_000)
		return () => clearInterval(timer)
	}, [])
	const data = useQuery(api.functions.moderation.work.queue, {})
	const claim = useMutation(api.functions.moderation.work.claim)
	const [type, setType] = useState('')
	const [assignment, setAssignment] = useState('')
	const [age, setAge] = useState('')
	if (!data) {
		return null
	}
	const rows = data.rows.filter(
		(row) =>
			(!type || (row.packType ?? row.type) === type) &&
			(!assignment ||
				(assignment === 'Mine' ? row.mine : !row.assignee)) &&
			(!age || clock - row.submittedAt >= 86_400_000),
	)
	return (
		<Card className="mb-6">
			<CardHeader>
				<CardTitle>
					Awaiting review: {data.rows.length}
					{data.more ? '+' : ''}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-3">
					<Filter
						label="All content"
						options={['server', 'plugin', 'addon', 'resource_pack']}
						set={setType}
						value={type}
					/>
					<Filter
						label="All assignments"
						options={['Mine', 'Unassigned']}
						set={setAssignment}
						value={assignment}
					/>
					<Filter
						label="Any waiting time"
						options={['Over 24 hours']}
						set={setAge}
						value={age}
					/>
				</div>
				<p className="text-muted-foreground text-sm">
					Oldest submissions first. Up to 100 pending submissions per
					content group, including standalone version submissions.
				</p>
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr>
								<th className="p-2">Submission</th>
								<th className="p-2">Waiting</th>
								<th className="p-2">Reviewer</th>
								<th className="p-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr className="border-t" key={row.id}>
									<td className="p-2">
										<Link
											className="underline"
											href={`/admin/${{ project: 'projects', server: 'servers', plugin: 'plugins' }[row.type]}/${row.projectId ?? row.id}${row.version ? `#release-${row.id}` : ''}`}
										>
											{row.name}
											{row.version
												? ` v${row.version}`
												: ''}
										</Link>
										<p className="text-muted-foreground">
											{row.packType ?? row.type}
										</p>
									</td>
									<td className="p-2">
										{Math.max(
											0,
											Math.floor(
												(clock - row.submittedAt) /
													3_600_000,
											),
										)}{' '}
										hours
									</td>
									<td className="p-2">
										{row.assignee ?? 'Unassigned'}
									</td>
									<td className="p-2">
										<Button
											disabled={Boolean(
												row.assignee && !row.mine,
											)}
											onClick={async () => {
												try {
													await claim({
														contentId: row.id as
															| Id<'servers'>
															| Id<'projects'>
															| Id<'plugins'>
															| Id<'projectVersions'>,
														revision: row.revision,
														release: row.mine,
													})
													toast.success(
														row.mine
															? 'Review released'
															: 'Review assigned to you',
													)
												} catch (error) {
													toast.error(
														error instanceof Error
															? error.message
															: 'Could not claim review',
													)
												}
											}}
											size="sm"
											variant="outline"
										>
											{row.mine
												? 'Release review'
												: 'Claim review'}
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{rows.length === 0 ? (
					<p>No submissions match these filters.</p>
				) : null}
			</CardContent>
		</Card>
	)
}
