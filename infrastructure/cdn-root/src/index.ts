const JSON_HEADERS = {
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
	'Access-Control-Allow-Origin': '*',
	'Cache-Control': 'public, max-age=300',
	'Content-Type': 'application/json; charset=utf-8',
	'X-Content-Type-Options': 'nosniff',
} as const

const NOT_FOUND_BODY = JSON.stringify({
	error: 'not_found',
	description: 'the requested resource does not exist',
})

export function handleRequest(request: Request): Response {
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: JSON_HEADERS,
		})
	}

	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response(
			JSON.stringify({
				error: 'method_not_allowed',
				description:
					'only GET, HEAD, and OPTIONS requests are supported',
			}),
			{
				status: 405,
				headers: {
					...JSON_HEADERS,
					Allow: 'GET, HEAD, OPTIONS',
				},
			},
		)
	}

	return new Response(request.method === 'HEAD' ? null : NOT_FOUND_BODY, {
		status: 404,
		headers: JSON_HEADERS,
	})
}

export default {
	fetch(request: Request): Response {
		return handleRequest(request)
	},
}
