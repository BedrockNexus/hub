'use client'

import { Delete02Icon, ServerStack03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { WorkspacePageHeader } from '@/components/workspace-page-header'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useListOrganizations } from '@/hooks/use-organization'
import { userFacingError } from '@/lib/user-facing-error'

type Network = FunctionReturnType<
	typeof api.functions.servers.networks.listMine
>[number]

function CreateNetworkForm({ organizationId }: { organizationId?: string }) {
	const create = useMutation(api.functions.servers.networks.create)
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [website, setWebsite] = useState('')
	const [pending, setPending] = useState(false)

	const onSubmit = async (event: FormEvent) => {
		event.preventDefault()
		setPending(true)
		try {
			await create({ name, description, website, organizationId })
			toast.success('Network created')
			setName('')
			setDescription('')
			setWebsite('')
		} catch (error) {
			toast.error(userFacingError(error, 'Could not create the network'))
		} finally {
			setPending(false)
		}
	}

	return (
		<form
			className="space-y-4 rounded-md border border-dashed p-4"
			onSubmit={onSubmit}
		>
			<p className="font-semibold">New network</p>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="network-name">Name</FieldLabel>
					<Input
						id="network-name"
						maxLength={60}
						onChange={(event) => setName(event.target.value)}
						required
						value={name}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="network-website">Website</FieldLabel>
					<Input
						id="network-website"
						onChange={(event) => setWebsite(event.target.value)}
						placeholder="https://"
						type="url"
						value={website}
					/>
				</Field>
			</div>
			<Field>
				<FieldLabel htmlFor="network-description">
					Description
				</FieldLabel>
				<Textarea
					id="network-description"
					maxLength={500}
					onChange={(event) => setDescription(event.target.value)}
					rows={2}
					value={description}
				/>
			</Field>
			<Button disabled={pending || !name.trim()} type="submit">
				Create network
			</Button>
		</form>
	)
}

interface ServerOption {
	_id: Id<'servers'>
	name: string
	networkId?: Id<'serverNetworks'>
}

function NetworkCard({
	network,
	servers,
}: {
	network: Network
	servers: ServerOption[]
}) {
	const setServerNetwork = useMutation(
		api.functions.servers.networks.setServerNetwork,
	)
	const remove = useMutation(api.functions.servers.networks.remove)
	const members = new Set(network.servers.map((server) => server._id))

	const toggle = async (serverId: Id<'servers'>, add: boolean) => {
		try {
			await setServerNetwork({
				serverId,
				networkId: add ? network._id : null,
			})
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update the network'))
		}
	}

	return (
		<li className="space-y-3 rounded-md border bg-card p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0">
					<Link
						className="font-semibold hover:text-ember-text"
						href={`/networks/${network.publicId}` as Route}
					>
						{network.name}
					</Link>
					<p className="text-muted-foreground text-sm">
						{network.servers.length === 1
							? '1 server'
							: `${network.servers.length} servers`}
						{network.servers.length === 0
							? ' · the page appears once a listed server joins'
							: ''}
					</p>
				</div>
				<Button
					aria-label={`Delete ${network.name}`}
					onClick={async () => {
						try {
							await remove({ networkId: network._id })
							toast.success('Network deleted')
						} catch (error) {
							toast.error(
								userFacingError(
									error,
									'Could not delete the network',
								),
							)
						}
					}}
					size="icon-sm"
					type="button"
					variant="destructive"
				>
					<HugeiconsIcon icon={Delete02Icon} />
				</Button>
			</div>
			{servers.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					This owner has no servers yet.
				</p>
			) : (
				<fieldset className="flex flex-wrap gap-2">
					<legend className="sr-only">
						Servers in {network.name}
					</legend>
					{servers.map((server) => {
						const inThis = members.has(server._id)
						const inOther =
							!inThis && server.networkId !== undefined
						return (
							<Button
								aria-pressed={inThis}
								key={server._id}
								onClick={() => toggle(server._id, !inThis)}
								size="sm"
								title={
									inOther
										? 'Moves it from its current network'
										: undefined
								}
								type="button"
								variant={inThis ? 'secondary' : 'outline'}
							>
								{server.name}
							</Button>
						)
					})}
				</fieldset>
			)}
		</li>
	)
}

function NetworkList({
	networks,
	servers,
}: {
	networks: Network[] | undefined
	servers: ServerOption[] | undefined
}) {
	if (networks === undefined || servers === undefined) {
		return <Skeleton className="h-40" />
	}
	if (networks.length === 0) {
		return (
			<Empty className="border border-dashed py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={ServerStack03Icon} />
					</EmptyMedia>
					<EmptyTitle>No networks yet</EmptyTitle>
					<EmptyDescription>
						Create one below, then pick which servers belong to it.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}
	return (
		<ul className="space-y-3">
			{networks.map((network) => (
				<NetworkCard
					key={network._id}
					network={network}
					servers={servers}
				/>
			))}
		</ul>
	)
}

export default function NetworksPage() {
	const { organizations } = useListOrganizations()
	const [organizationId, setOrganizationId] = useState<string>('')
	const owner = organizationId || undefined
	const networks = useQuery(api.functions.servers.networks.listMine, {
		organizationId: owner,
	})
	const personalServers = useQuery(
		api.functions.servers.servers.listMyServers,
		owner ? 'skip' : {},
	)
	const orgServers = useQuery(
		api.functions.servers.servers.listByOrganization,
		owner ? { organizationId: owner } : 'skip',
	)
	const servers = (owner ? orgServers : personalServers)?.map((server) => ({
		_id: server._id,
		name: server.name,
		networkId: server.networkId,
	}))

	return (
		<div className="space-y-6">
			<WorkspacePageHeader
				description="Group servers you run under one network page with their combined player count. A server can only join a network with the same owner."
				title="Networks"
			/>
			{organizations.length > 0 ? (
				<Field className="max-w-xs">
					<FieldLabel htmlFor="network-owner">Owner</FieldLabel>
					<Select
						items={[
							{ value: null, label: 'You' },
							...organizations.map((organization) => ({
								value: organization.id,
								label: organization.name,
							})),
						]}
						onValueChange={(value) =>
							setOrganizationId(value ?? '')
						}
						value={organizationId || null}
					>
						<SelectTrigger className="w-full" id="network-owner">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={null}>You</SelectItem>
							{organizations.map((organization) => (
								<SelectItem
									key={organization.id}
									value={organization.id}
								>
									{organization.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>
						Networks belong to you or an organization.
					</FieldDescription>
				</Field>
			) : null}
			<NetworkList networks={networks} servers={servers} />
			<CreateNetworkForm organizationId={owner} />
		</div>
	)
}
