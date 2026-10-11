function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
		'',
	)
}

function constantTimeEqual(left: string, right: string) {
	if (left.length !== right.length) {
		return false
	}

	let difference = 0
	for (let index = 0; index < left.length; index += 1) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
	}
	return difference === 0
}

export async function createGitHubWebhookSignature(
	secret: string,
	payload: string,
) {
	const encoder = new TextEncoder()
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	)
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(payload),
	)

	return `sha256=${bytesToHex(new Uint8Array(signature))}`
}

export async function verifyGitHubWebhookSignature(
	secret: string,
	payload: string,
	signature: string,
) {
	if (!signature.startsWith('sha256=')) {
		return false
	}

	const expected = await createGitHubWebhookSignature(secret, payload)
	return constantTimeEqual(expected, signature)
}
