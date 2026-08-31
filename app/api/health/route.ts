export function GET() {
	return Response.json(
		{
			name: 'BedrockNexus Hub',
			status: 'ok',
		},
		{
			headers: {
				'Cache-Control': 'no-store',
			},
		},
	)
}
