'use client'

import {
	Alert02Icon,
	Cancel01Icon,
	Tick02Icon,
	Wifi01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import { useMinute } from '@/hooks/use-minute'
import {
	BedrockApiError,
	type BedrockStatusResponse,
	fetchBedrockStatus,
} from '@/lib/bedrock-api'
import { versionStanding } from '@/lib/game-version-standing'
import { parseMinecraftText } from '@/lib/minecraft-text'
import { cn } from '@/lib/utils'

type Listing = NonNullable<
	FunctionReturnType<typeof api.functions.servers.ping.findListing>
>

interface Pinged {
	host: string
	port: number
	at: number
	result: BedrockStatusResponse
}

function timeAgo(milliseconds: number) {
	const minutes = Math.floor(Math.max(0, milliseconds) / 60_000)
	if (minutes < 1) {
		return 'just now'
	}
	if (minutes < 60) {
		return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
	}
	const hours = Math.floor(minutes / 60)
	if (hours < 48) {
		return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
	}
	return `${Math.floor(hours / 24)} days ago`
}

/** Text with Bedrock `§` codes, coloured as the game draws it. */
function MinecraftText({ text }: { text: string }) {
	return (
		<>
			{parseMinecraftText(text).map((run, index) => (
				<span
					className={cn(
						run.bold && 'font-bold',
						run.italic && 'italic',
					)}
					// Runs never reorder, so the position is a stable key.
					// biome-ignore lint/suspicious/noArrayIndexKey: see above
					key={index}
					style={run.color ? { color: run.color } : undefined}
				>
					{run.text}
				</span>
			))}
		</>
	)
}

function Card({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<section className={cn('rounded-lg border bg-card p-4.5', className)}>
			{children}
		</section>
	)
}

function CheckMark({ ok }: { ok: boolean }) {
	return (
		<span
			aria-hidden
			className={cn(
				'mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full',
				ok
					? 'bg-online/15 text-online'
					: 'bg-destructive/15 text-destructive',
			)}
		>
			<HugeiconsIcon
				icon={ok ? Tick02Icon : Cancel01Icon}
				size={12}
				strokeWidth={2.5}
			/>
		</span>
	)
}

function StatusPill({
	tone,
	children,
}: {
	tone: 'online' | 'limited' | 'offline'
	children: ReactNode
}) {
	const styles = {
		online: 'bg-online/15 text-online',
		limited: 'bg-primary/15 text-primary',
		offline: 'bg-destructive/15 text-destructive',
	}
	const dots = {
		online: 'bg-online',
		limited: 'bg-primary',
		offline: 'bg-destructive',
	}
	return (
		<span
			className={cn(
				'inline-flex items-center gap-2 rounded-full px-3 py-1 font-bold font-display text-sm',
				styles[tone],
			)}
		>
			<span
				aria-hidden
				className={cn('size-2 rounded-full', dots[tone])}
			/>
			{children}
		</span>
	)
}

/** The server as it looks in the Minecraft server list. */
function ServerListPreview({
	result,
	host,
	iconUrl,
}: {
	result: BedrockStatusResponse
	host: string
	iconUrl?: string
}) {
	return (
		<div
			aria-label="How the server looks in the Minecraft server list"
			className="flex items-center gap-3.5 border-2 border-black bg-[#1e1e1e] px-3.5 py-3 font-mono shadow-[inset_0_0_0_2px_#3a3a3a]"
			role="img"
		>
			{iconUrl ? (
				<Image
					alt=""
					className="size-13 shrink-0 object-cover [image-rendering:pixelated]"
					height={52}
					src={iconUrl}
					width={52}
				/>
			) : (
				<span
					aria-hidden
					className="size-13 shrink-0 bg-[#4b7a3a] shadow-[inset_0_-6px_0_#2f5124,inset_0_6px_0_#6fa14f]"
				/>
			)}
			<div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[15px] leading-snug">
				<span className="truncate text-[#aaaaaa]">
					<MinecraftText text={result.motdRaw ?? host} />
				</span>
				{result.mapNameRaw ? (
					<span className="truncate text-[#aaaaaa]">
						<MinecraftText text={result.mapNameRaw} />
					</span>
				) : null}
			</div>
			<span className="shrink-0 text-[#aaaaaa] text-[15px]">
				{result.players?.online ?? 0}
				<span className="text-[#555555]">/</span>
				{result.players?.max ?? 0}
			</span>
		</div>
	)
}

function ConnectionsCard({ result }: { result: BedrockStatusResponse }) {
	const { nethernet, raknet } = result.transports ?? {
		nethernet: false,
		raknet: false,
	}
	let summary = 'Players on every current version can join.'
	if (!nethernet) {
		summary = 'Players on Bedrock 26.60 and later can’t join.'
	} else if (!raknet) {
		summary =
			'Only NetherNet answered, so versions before 26.60 may not be able to join.'
	}
	return (
		<Card className="flex flex-col gap-3">
			<h2 className="font-bold font-display text-[17px]">
				Who can connect
			</h2>
			<div className="flex items-start gap-3">
				<CheckMark ok={nethernet} />
				<div className="flex flex-col gap-0.5">
					<span className="font-semibold">
						{nethernet
							? 'NetherNet answered'
							: 'NetherNet: no answer'}
					</span>
					<span className="text-muted-foreground text-sm">
						How Bedrock 26.60 and later connect
					</span>
				</div>
			</div>
			<div className="flex items-start gap-3">
				<CheckMark ok={raknet} />
				<div className="flex flex-col gap-0.5">
					<span className="font-semibold">
						{raknet ? 'RakNet answered' : 'RakNet: no answer'}
						{raknet && result.latencyMs
							? ` · ${result.latencyMs} ms`
							: ''}
					</span>
					<span className="text-muted-foreground text-sm">
						How older versions connect
					</span>
				</div>
			</div>
			<p
				className={cn(
					'mt-1 border-t pt-3 font-medium text-sm',
					nethernet && raknet ? 'text-online' : 'text-primary',
				)}
			>
				{summary}
			</p>
		</Card>
	)
}

function PlayersCard({ result }: { result: BedrockStatusResponse }) {
	const online = result.players?.online ?? 0
	const max = result.players?.max ?? 0
	const share = max ? Math.min(100, (online / max) * 100) : 0
	return (
		<Card className="flex flex-col gap-3">
			<h2 className="font-bold font-display text-[17px]">Players</h2>
			<div className="flex items-baseline gap-2">
				<span className="font-bold font-display text-[2rem] leading-none">
					{online.toLocaleString()}
				</span>
				<span className="text-muted-foreground">
					of {max.toLocaleString()} slots
				</span>
			</div>
			<div aria-hidden className="h-2 overflow-hidden rounded bg-muted">
				<div
					className="h-full rounded bg-online"
					style={{ width: `${share}%` }}
				/>
			</div>
			<p className="text-muted-foreground text-sm">
				The count the server reports. Some servers report a fixed
				number.
			</p>
		</Card>
	)
}

function VersionValue({ version }: { version?: string }) {
	const versions = useQuery(api.functions.site.gameVersions.listActive, {})
	const standing = versionStanding(
		version,
		(versions ?? []).map((item) => item.version),
	)
	if (!version) {
		return <span className="text-muted-foreground">Not reported</span>
	}
	return (
		<span className="flex flex-wrap items-center gap-2">
			<span className="font-medium font-mono">{version}</span>
			{standing ? (
				<span
					className={cn(
						'rounded-full px-2.5 py-0.5 font-semibold text-xs',
						standing.behind
							? 'bg-primary/15 text-primary'
							: 'bg-online/15 text-online',
					)}
					title={`The current release is ${standing.latest}`}
				>
					{standing.behind
						? `${standing.behind} ${standing.behind === 1 ? 'version' : 'versions'} behind`
						: 'Up to date'}
				</span>
			) : null}
		</span>
	)
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5 px-4.5 py-4">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	)
}

function FactsCard({
	result,
	address,
}: {
	result: BedrockStatusResponse
	address: string
}) {
	const [open, setOpen] = useState(false)
	const details: [string, string | undefined][] = [
		['IPv6 port', result.portV6 ? String(result.portV6) : undefined],
		['Server ID', result.serverId || undefined],
		['Raw MOTD', result.motdRaw],
	]
	const shownDetails = details.filter(([, value]) => value)
	return (
		<section className="rounded-lg border bg-card">
			<dl className="grid divide-border sm:grid-cols-3 sm:[&>div:nth-child(3n+1)]:border-r sm:[&>div:nth-child(3n+2)]:border-r [&>div]:border-b">
				<Fact label="Version">
					<VersionValue version={result.version} />
				</Fact>
				<Fact label="Protocol">
					<span className="font-medium font-mono">
						{result.protocolVersion || 'Not reported'}
					</span>
				</Fact>
				<Fact label="Game mode">
					<span className="font-medium">
						{result.gamemode || 'Not reported'}
					</span>
				</Fact>
				<Fact label="Address">
					<span className="font-medium font-mono text-sm">
						{address}
					</span>
				</Fact>
				<Fact label="World">
					<span className="font-medium">
						{result.mapName || 'Not reported'}
					</span>
				</Fact>
				<Fact label="Latency">
					<span className="flex flex-col gap-0.5">
						<span className="font-medium font-mono">
							{result.latencyMs
								? `${result.latencyMs} ms`
								: 'Not measured'}
						</span>
						<span className="text-muted-foreground text-xs">
							From our checker, not your device
						</span>
					</span>
				</Fact>
			</dl>
			{shownDetails.length ? (
				<>
					<div className="px-4.5 py-2">
						<Button
							aria-expanded={open}
							className="px-0 text-primary"
							onClick={() => setOpen((value) => !value)}
							variant="link"
						>
							{open ? 'Hide details' : 'More details'}
						</Button>
					</div>
					{open ? (
						<dl className="grid grid-cols-[minmax(110px,180px)_minmax(0,1fr)] px-4.5 pb-4 text-sm">
							{shownDetails.map(([label, value]) => (
								<div className="contents" key={label}>
									<dt className="border-t py-2.5 text-muted-foreground">
										{label}
									</dt>
									<dd className="break-all border-t py-2.5 font-mono text-[13px]">
										{value}
									</dd>
								</div>
							))}
						</dl>
					) : null}
				</>
			) : null}
		</section>
	)
}

function uptimeColor(uptime: number) {
	if (uptime >= 0.99) {
		return 'bg-online'
	}
	return uptime >= 0.5 ? 'bg-primary' : 'bg-destructive'
}

function ListingCard({ listing }: { listing: Listing }) {
	const days = listing.days
	const average = days.length
		? days.reduce((sum, day) => sum + day.uptime, 0) / days.length
		: undefined
	return (
		<section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border border-primary/40 bg-primary/5 p-4.5">
			<div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
				<span className="font-semibold text-primary text-sm">
					Listed on BedrockNexus as{' '}
					<span className="text-foreground">{listing.name}</span>
				</span>
				{average === undefined ? null : (
					<div className="flex max-w-md flex-col gap-1.5">
						<span className="text-sm">
							Up {Math.round(average * 1000) / 10}% over the last{' '}
							{days.length} {days.length === 1 ? 'day' : 'days'}
						</span>
						<div
							aria-label={days
								.map(
									(day) =>
										`${day.dayKey}: ${Math.round(day.uptime * 100)}% up`,
								)
								.join(', ')}
							className="grid gap-1"
							role="img"
							style={{
								gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
							}}
						>
							{days.map((day) => (
								<span
									className={cn(
										'h-5 rounded-sm',
										uptimeColor(day.uptime),
									)}
									key={day.dayKey}
									title={`${day.dayKey}: ${Math.round(day.uptime * 100)}% up`}
								/>
							))}
						</div>
					</div>
				)}
			</div>
			<Link
				className={buttonVariants()}
				href={`/server/${listing.reference}` as Route}
			>
				View {listing.name} on BedrockNexus
			</Link>
		</section>
	)
}

function ListThisServer() {
	return (
		<Card className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5">
			<div className="flex flex-[1_1_360px] flex-col gap-1">
				<span className="font-bold font-display text-[17px]">
					Is this your server?
				</span>
				<span className="text-muted-foreground text-sm">
					List it on BedrockNexus for free: players find it by game
					mode and region, and we keep checking that it is up.
				</span>
			</div>
			<Link className={buttonVariants()} href="/dashboard/servers/add">
				List this server
			</Link>
		</Card>
	)
}

function OfflineResult({
	pinged,
	listing,
}: {
	pinged: Pinged
	listing: Listing | null | undefined
}) {
	const now = useMinute()
	return (
		<>
			<div className="flex flex-col">
				<h2 className="mb-2 font-bold font-display text-[17px]">
					What we checked
				</h2>
				<div className="flex items-start gap-3 border-b py-2.5">
					<CheckMark ok />
					<span>
						<span className="font-mono">{pinged.host}</span> is a
						valid address
					</span>
				</div>
				<div className="flex items-start gap-3 border-b py-2.5">
					<CheckMark ok={false} />
					<span>No answer over NetherNet on port {pinged.port}</span>
				</div>
				<div className="flex items-start gap-3 py-2.5">
					<CheckMark ok={false} />
					<span>No answer over RakNet on UDP port {pinged.port}</span>
				</div>
			</div>
			<div className="flex flex-col gap-2.5 rounded-lg border bg-background/40 p-4">
				<h2 className="font-semibold">If this is your server</h2>
				<ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground text-sm">
					<li>Make sure it is running and has finished starting.</li>
					<li>
						Bedrock uses UDP. Open UDP port {pinged.port} in the
						firewall and router; a TCP rule alone is not enough.
					</li>
					<li>
						Check the port in the server's settings. 19132 is the
						default; some hosts give you another.
					</li>
					<li>
						Some hosts block pings from outside. The server may
						still be up for players.
					</li>
				</ul>
			</div>
			{listing ? (
				<Card className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
					<div className="flex flex-col gap-1">
						<span className="text-muted-foreground text-sm">
							Listed on BedrockNexus as{' '}
							<span className="font-semibold text-foreground">
								{listing.name}
							</span>
						</span>
						{listing.lastOnline ? (
							<span>
								Last seen online{' '}
								<span className="font-semibold">
									{timeAgo(now - listing.lastOnline)}
								</span>
							</span>
						) : null}
					</div>
					<Link
						className={buttonVariants({ variant: 'outline' })}
						href={`/server/${listing.reference}` as Route}
					>
						View listing
					</Link>
				</Card>
			) : null}
		</>
	)
}

function PingResult({
	pinged,
	onPing,
	isLoading,
}: {
	pinged: Pinged
	onPing: () => void
	isLoading: boolean
}) {
	const now = useMinute()
	const listing = useQuery(api.functions.servers.ping.findListing, {
		host: pinged.host,
		port: pinged.port,
	})
	const { result } = pinged
	let tone: 'online' | 'limited' | 'offline' = 'offline'
	let label = 'No answer'
	if (result.online) {
		const limited = result.transports && !result.transports.nethernet
		tone = limited ? 'limited' : 'online'
		label = limited ? 'Online, limited' : 'Online'
	}
	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			toast.success('Link copied. Opening it pings the server again.')
		} catch {
			toast.error('Could not copy the link')
		}
	}
	return (
		<section aria-live="polite" className="flex flex-col gap-4">
			<Card className="flex flex-col gap-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
						<StatusPill tone={tone}>{label}</StatusPill>
						<span className="text-muted-foreground text-sm">
							Checked {timeAgo(now - pinged.at)}
						</span>
					</div>
					<div className="flex gap-2">
						<Button
							disabled={isLoading}
							onClick={onPing}
							variant="outline"
						>
							{isLoading ? <Spinner className="size-4" /> : null}
							Ping again
						</Button>
						<Button onClick={copyLink} variant="outline">
							Copy link
						</Button>
					</div>
				</div>
				{result.online ? null : (
					<OfflineResult listing={listing} pinged={pinged} />
				)}
				{result.online ? (
					<ServerListPreviewOnly listing={listing} pinged={pinged} />
				) : null}
			</Card>
			{result.online ? (
				<OnlineDetails listing={listing} pinged={pinged} />
			) : null}
		</section>
	)
}

/** The preview sits in the status card; the rest follows below it. */
function ServerListPreviewOnly({
	pinged,
	listing,
}: {
	pinged: Pinged
	listing: Listing | null | undefined
}) {
	return (
		<>
			<ServerListPreview
				host={pinged.host}
				iconUrl={listing?.logoUrl}
				result={pinged.result}
			/>
			<p className="-mt-2 text-[13px] text-muted-foreground">
				Shown as players see it in the server list, with the server's
				own colours.
			</p>
		</>
	)
}

function OnlineDetails({
	pinged,
	listing,
}: {
	pinged: Pinged
	listing: Listing | null | undefined
}) {
	const { result } = pinged
	const raknetOnly = Boolean(
		result.transports?.raknet && !result.transports.nethernet,
	)
	let listingCard: ReactNode = null
	if (listing) {
		listingCard = <ListingCard listing={listing} />
	} else if (listing === null) {
		listingCard = <ListThisServer />
	}
	return (
		<>
			{raknetOnly ? (
				<div
					className="flex items-start gap-3.5 rounded-lg border border-primary/40 bg-primary/5 p-4"
					role="alert"
				>
					<HugeiconsIcon
						aria-hidden
						className="mt-0.5 shrink-0 text-primary"
						icon={Alert02Icon}
						size={20}
					/>
					<div className="flex flex-col gap-1">
						<span className="font-semibold">
							Players on Bedrock 26.60 and later can’t join
						</span>
						<span className="text-muted-foreground text-sm">
							The server answered over RakNet only. Newer clients
							connect over NetherNet, so they see it as offline.
							Updating the server software to a version that
							supports NetherNet fixes this.
						</span>
					</div>
				</div>
			) : null}
			<div className="grid gap-4 md:grid-cols-2">
				{result.transports ? <ConnectionsCard result={result} /> : null}
				<PlayersCard result={result} />
			</div>
			<FactsCard
				address={`${pinged.host}:${result.port ?? pinged.port}`}
				result={result}
			/>
			{listingCard}
		</>
	)
}

export function ServerPingTool({
	initialHost,
	initialPort,
}: {
	initialHost: string
	initialPort: number
}) {
	const router = useRouter()
	const [host, setHost] = useState(initialHost)
	const [port, setPort] = useState(String(initialPort))
	const [pinged, setPinged] = useState<Pinged | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	const pingServer = useCallback(
		async (nextHost: string, nextPort: number) => {
			setIsLoading(true)
			setError(null)
			try {
				const result = await fetchBedrockStatus(nextHost, nextPort)
				setPinged({
					host: nextHost,
					port: nextPort,
					at: Date.now(),
					result,
				})
				router.replace(
					`/tools/server-ping?host=${encodeURIComponent(nextHost)}&port=${nextPort}`,
					{ scroll: false },
				)
			} catch (caughtError) {
				setPinged(null)
				setError(
					caughtError instanceof BedrockApiError
						? caughtError.message
						: 'The server could not be checked. Try again shortly.',
				)
			} finally {
				setIsLoading(false)
			}
		},
		[router],
	)

	// Ping a shared link once on load. Later pings update the URL themselves,
	// which must not trigger a second request.
	const pingedInitial = useRef(false)
	useEffect(() => {
		if (initialHost && !pingedInitial.current) {
			pingedInitial.current = true
			pingServer(initialHost, initialPort).catch(() => undefined)
		}
	}, [initialHost, initialPort, pingServer])

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const normalizedHost = host.trim()
		const parsedPort = Number.parseInt(port, 10)
		if (!normalizedHost) {
			setError('Enter a server hostname or IP address.')
			return
		}
		if (
			!Number.isInteger(parsedPort) ||
			parsedPort < 1 ||
			parsedPort > 65_535
		) {
			setError('Port must be a number between 1 and 65535.')
			return
		}
		pingServer(normalizedHost, parsedPort).catch(() => undefined)
	}

	return (
		<main className="mx-auto flex w-full max-w-[980px] flex-col gap-5 px-5 py-9 sm:py-12">
			<div className="flex flex-col gap-2">
				<h1 className="font-bold font-display text-[2.1rem]">
					Server Ping
				</h1>
				<p className="text-muted-foreground">
					Check any Bedrock server: whether it is up, who can join,
					and what it tells players.
				</p>
			</div>

			<form
				className="grid gap-3 rounded-lg border bg-card p-4.5 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
				onSubmit={handleSubmit}
			>
				<Field>
					<FieldLabel htmlFor="server-host">
						Server address
					</FieldLabel>
					<Input
						autoComplete="off"
						className="h-11"
						disabled={isLoading}
						id="server-host"
						onChange={(event) => setHost(event.target.value)}
						placeholder="play.example.com"
						value={host}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="server-port">Port</FieldLabel>
					<Input
						className="h-11 font-mono"
						disabled={isLoading}
						id="server-port"
						inputMode="numeric"
						onChange={(event) => setPort(event.target.value)}
						value={port}
					/>
				</Field>
				<Button
					className="h-11 px-5"
					disabled={isLoading}
					type="submit"
				>
					{isLoading ? (
						<Spinner className="size-4" />
					) : (
						<HugeiconsIcon
							aria-hidden
							icon={Wifi01Icon}
							size={17}
						/>
					)}
					{isLoading ? 'Pinging' : 'Ping server'}
				</Button>
			</form>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Could not check the server</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{pinged ? (
				<PingResult
					isLoading={isLoading}
					onPing={() =>
						pingServer(pinged.host, pinged.port).catch(
							() => undefined,
						)
					}
					pinged={pinged}
				/>
			) : null}
		</main>
	)
}
