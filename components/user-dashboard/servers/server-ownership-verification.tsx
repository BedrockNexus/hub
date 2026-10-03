'use client'

import {
	CheckmarkCircle02Icon,
	CheckmarkSquare02Icon,
	Copy01Icon,
	RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAction } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/convex/_generated/api'

type VerificationMethod = 'dns_txt' | 'motd_token'

export interface VerifiedServerTarget {
	ipAddress: string
	port: number
}

const VERIFICATION_PREFIX = 'bedrocknexus-verify='

function copyToClipboard(text: string) {
	navigator.clipboard.writeText(text)
	toast.success('Copied to clipboard!')
}

/**
 * Proves ownership of `ipAddress:port` with the caller's server-issued code.
 * A successful check stores a short-lived proof that the create and update
 * mutations consume, so the parent only needs to submit the same address.
 */
export function ServerOwnershipVerification({
	ipAddress,
	port,
	verified,
	onVerified,
	onBusyChange,
}: {
	ipAddress: string
	port: number
	verified: boolean
	onVerified: (target: VerifiedServerTarget) => void
	onBusyChange?: (busy: boolean) => void
}) {
	const [code, setCode] = useState<string | null>(null)
	const [method, setMethod] = useState<VerificationMethod>('motd_token')
	const [isGenerating, setIsGenerating] = useState(false)
	const [isVerifying, setIsVerifying] = useState(false)

	const generateCode = useAction(
		api.functions.servers.verification.generateCode,
	)
	const verifyOwnership = useAction(
		api.functions.servers.verification.verifyOwnership,
	)

	useEffect(() => {
		onBusyChange?.(isGenerating || isVerifying)
	}, [isGenerating, isVerifying, onBusyChange])

	const loadCode = useCallback(
		async (rotate: boolean) => {
			setIsGenerating(true)
			try {
				setCode(await generateCode({ rotate }))
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: 'Failed to generate verification code',
				)
			} finally {
				setIsGenerating(false)
			}
		},
		[generateCode],
	)

	useEffect(() => {
		loadCode(false)
	}, [loadCode])

	const verify = async () => {
		if (!code) {
			return
		}
		if (
			!(
				ipAddress &&
				Number.isInteger(port) &&
				port >= 1 &&
				port <= 65_535
			)
		) {
			toast.error('Enter a valid server address first')
			return
		}
		setIsVerifying(true)
		try {
			const result = await verifyOwnership({
				code,
				ipAddress,
				method,
				port,
			})
			if (result.verified) {
				onVerified({ ipAddress, port })
				toast.success('Server ownership verified!')
			} else {
				toast.error(
					result.error ||
						`Verification failed. Check the ${
							method === 'dns_txt' ? 'DNS record' : 'server MOTD'
						} and try again.`,
				)
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Verification failed. Please try again.',
			)
		} finally {
			setIsVerifying(false)
		}
	}

	if (verified) {
		return (
			<Alert>
				<HugeiconsIcon
					className="size-4"
					icon={CheckmarkCircle02Icon}
				/>
				<AlertTitle>Ownership verified</AlertTitle>
				<AlertDescription>
					{ipAddress}:{port} is verified for your account. Save within
					30 minutes to use this verification.
				</AlertDescription>
			</Alert>
		)
	}

	if (!code) {
		return <Skeleton className="h-64 w-full rounded-md" />
	}

	const token = `${VERIFICATION_PREFIX}${code}`

	return (
		<div className="space-y-4 rounded-md border bg-muted/50 p-6">
			<div className="space-y-3">
				<h3 className="font-semibold">Verify server ownership</h3>
				<p className="text-muted-foreground text-sm">
					Choose the method that best fits how you manage your server.
				</p>
				<Tabs
					onValueChange={(value) => {
						if (value === 'dns_txt' || value === 'motd_token') {
							setMethod(value)
						}
					}}
					value={method}
				>
					<TabsList className="w-full max-w-sm">
						<TabsTrigger value="motd_token">
							Server MOTD
						</TabsTrigger>
						<TabsTrigger value="dns_txt">DNS Record</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<div className="space-y-3">
				<div>
					<p className="mb-1 font-medium text-sm">
						{method === 'motd_token'
							? '1. Add this token anywhere in your server MOTD:'
							: '1. Add this TXT record to your domain:'}
					</p>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<code className="min-w-0 flex-1 break-all rounded border bg-background px-3 py-2 font-mono text-sm">
							{token}
						</code>
						<Button
							aria-label="Copy verification token"
							className="self-start sm:self-auto"
							onClick={() => copyToClipboard(token)}
							size="icon"
							type="button"
							variant="outline"
						>
							<HugeiconsIcon
								className="size-4"
								icon={Copy01Icon}
							/>
						</Button>
					</div>
				</div>

				{method === 'dns_txt' ? (
					<div>
						<p className="mb-1 font-medium text-sm">
							2. Add the record to this hostname:
						</p>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<code className="min-w-0 flex-1 break-all rounded border bg-background px-3 py-2 font-mono text-sm">
								{ipAddress}
							</code>
							<Button
								aria-label="Copy server hostname"
								className="self-start sm:self-auto"
								onClick={() => copyToClipboard(ipAddress)}
								size="icon"
								type="button"
								variant="outline"
							>
								<HugeiconsIcon
									className="size-4"
									icon={Copy01Icon}
								/>
							</Button>
						</div>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						2. Save or reload your server configuration so the
						updated MOTD is visible at{' '}
						<span className="font-medium text-foreground">
							{ipAddress}:{port}
						</span>
						.
					</p>
				)}

				<div className="pt-2">
					<p className="mb-3 text-muted-foreground text-xs">
						{method === 'dns_txt'
							? 'DNS changes can take a few minutes to propagate. The server must be online and pass the native Bedrock software check. This code is tied to your account and stays valid for 24 hours.'
							: 'The server must be online. Verification checks both MOTD lines and rejects Java servers using Geyser. This code is tied to your account and stays valid for 24 hours.'}
					</p>

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<Button
							className="w-full sm:w-auto"
							disabled={isVerifying || isGenerating}
							onClick={verify}
							type="button"
						>
							{isVerifying ? (
								<>
									<Spinner className="size-4" />
									Verifying...
								</>
							) : (
								<>
									<HugeiconsIcon
										className="size-4"
										icon={CheckmarkSquare02Icon}
									/>
									Verify Ownership
								</>
							)}
						</Button>
						<Button
							className="w-full sm:w-auto"
							disabled={isVerifying || isGenerating}
							onClick={() => loadCode(true)}
							type="button"
							variant="ghost"
						>
							{isGenerating ? (
								<>
									<Spinner className="size-4" />
									Generating...
								</>
							) : (
								<>
									<HugeiconsIcon
										className="size-4"
										icon={RefreshIcon}
									/>
									Generate New Code
								</>
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
