'use client'

import {
	Clock01Icon,
	DatabaseIcon,
	GameController03Icon,
	Globe02Icon,
	ServerStack01Icon,
	UserMultipleIcon,
	Wifi01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
	BedrockApiError,
	type BedrockStatusResponse,
	fetchBedrockStatus,
	getSoftwareClassificationLabel,
} from '@/lib/bedrock-api'

interface ServerPingToolProps {
	initialHost: string
	initialPort: number
}

interface ResultItemProps {
	icon: IconSvgElement
	label: string
	value: string
}

function ResultItem({ icon, label, value }: ResultItemProps) {
	return (
		<div className="flex min-w-0 items-center gap-3 border-b py-3 last:border-0 sm:border-0 sm:py-0">
			<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
				<HugeiconsIcon
					aria-hidden
					icon={icon}
					size={18}
					strokeWidth={1.8}
				/>
			</div>
			<div className="min-w-0">
				<p className="text-muted-foreground text-xs">{label}</p>
				<p className="truncate font-medium text-sm">{value}</p>
			</div>
		</div>
	)
}

export function ServerPingTool({
	initialHost,
	initialPort,
}: ServerPingToolProps) {
	const router = useRouter()
	const [host, setHost] = useState(initialHost)
	const [port, setPort] = useState(String(initialPort))
	const [result, setResult] = useState<BedrockStatusResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	const pingServer = useCallback(
		async (nextHost: string, nextPort: number) => {
			setIsLoading(true)
			setError(null)
			setResult(null)
			try {
				const data = await fetchBedrockStatus(nextHost, nextPort)
				setResult(data)
				router.replace(
					`/tools/server-ping?host=${encodeURIComponent(nextHost)}&port=${nextPort}`,
					{ scroll: false },
				)
			} catch (caughtError) {
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

	useEffect(() => {
		if (initialHost) {
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

	const software = result?.software
	const classification = software?.classification

	return (
		<main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
			<div className="mb-7 max-w-2xl">
				<h1 className="font-semibold text-3xl">Bedrock Server Ping</h1>
				<p className="mt-2 text-muted-foreground">
					Check the live status and connection details of any public
					Minecraft Bedrock server.
				</p>
			</div>

			<Card className="rounded-lg">
				<CardHeader>
					<CardTitle>Server address</CardTitle>
					<CardDescription>
						Use the Bedrock hostname and UDP port players connect
						with.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<form
						className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
						onSubmit={handleSubmit}
					>
						<Field>
							<FieldLabel htmlFor="server-host">
								Hostname or IP
							</FieldLabel>
							<Input
								autoComplete="off"
								disabled={isLoading}
								id="server-host"
								onChange={(event) =>
									setHost(event.target.value)
								}
								placeholder="play.example.com"
								value={host}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="server-port">Port</FieldLabel>
							<Input
								disabled={isLoading}
								id="server-port"
								inputMode="numeric"
								onChange={(event) =>
									setPort(event.target.value)
								}
								value={port}
							/>
						</Field>
						<Button disabled={isLoading} type="submit">
							{isLoading ? (
								<Spinner className="size-4" />
							) : (
								<HugeiconsIcon icon={Wifi01Icon} size={17} />
							)}
							{isLoading ? 'Pinging' : 'Ping server'}
						</Button>
					</form>

					{error && (
						<Alert variant="destructive">
							<AlertTitle>Server unavailable</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{result?.online && (
						<section aria-live="polite" className="border-t pt-6">
							<div className="mb-5 flex flex-wrap items-center gap-3">
								<Badge className="bg-emerald-600 text-white">
									Online
								</Badge>
								<p className="font-medium text-lg">
									{result.motd || host}
								</p>
							</div>
							<div className="grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-5 lg:grid-cols-3">
								<ResultItem
									icon={UserMultipleIcon}
									label="Players"
									value={`${result.players?.online ?? 0} / ${result.players?.max ?? 0}`}
								/>
								<ResultItem
									icon={Globe02Icon}
									label="Version"
									value={result.version || 'Unknown'}
								/>
								<ResultItem
									icon={DatabaseIcon}
									label="Protocol"
									value={String(
										result.protocolVersion || 'Unknown',
									)}
								/>
								<ResultItem
									icon={GameController03Icon}
									label="Game mode"
									value={result.gamemode || 'Unknown'}
								/>
								<ResultItem
									icon={Clock01Icon}
									label="Latency"
									value={
										result.latencyMs
											? `${result.latencyMs} ms`
											: 'Unknown'
									}
								/>
								<ResultItem
									icon={ServerStack01Icon}
									label="Address"
									value={`${host.trim()}:${result.port ?? port}`}
								/>
							</div>

							<div className="mt-6 grid gap-5 border-t pt-6 sm:grid-cols-2">
								<div>
									<p className="text-muted-foreground text-xs">
										World
									</p>
									<p className="mt-1 font-medium">
										{result.mapName || 'Not reported'}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">
										Software
									</p>
									<p className="mt-1 font-medium">
										{classification
											? getSoftwareClassificationLabel(
													classification,
												)
											: 'Not classified'}
									</p>
								</div>
							</div>

							{software && software.reasons.length > 0 && (
								<div className="mt-5 rounded-md bg-muted p-4">
									<p className="font-medium text-sm">
										Classification details
									</p>
									<ul className="mt-2 space-y-1 text-muted-foreground text-sm">
										{software.reasons.map((reason) => (
											<li key={reason}>{reason}</li>
										))}
									</ul>
								</div>
							)}

							{software && software.javaEndpoints.length > 0 && (
								<div className="mt-5 border-t pt-5">
									<p className="font-medium text-sm">
										Related Java endpoints
									</p>
									<div className="mt-2 space-y-2 text-muted-foreground text-sm">
										{software.javaEndpoints.map(
											(endpoint) => (
												<p
													key={`${endpoint.host}:${endpoint.port}`}
												>
													{endpoint.host}:
													{endpoint.port}
													{endpoint.version
														? ` - ${endpoint.version}`
														: ''}
												</p>
											),
										)}
									</div>
								</div>
							)}
						</section>
					)}
				</CardContent>
			</Card>
		</main>
	)
}
