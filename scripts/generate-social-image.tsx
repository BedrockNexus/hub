// Run with: bun scripts/generate-social-image.tsx
// Uses local brand fonts and logo; no network access or environment secrets.
/* eslint-disable @next/next/no-img-element -- drawn into a PNG by Satori, not rendered in a browser. */
import { readFile, writeFile } from 'node:fs/promises'
import { ImageResponse } from 'next/og'

const [display, body, logo] = await Promise.all([
	readFile(new URL('./assets/chakra-petch-700.woff', import.meta.url)),
	readFile(new URL('./assets/ibm-plex-sans-400.woff', import.meta.url)),
	readFile(
		new URL('../public/images/bedrocknexus-logo.png', import.meta.url),
	),
])
const image = new ImageResponse(
	<div
		style={{
			display: 'flex',
			flexDirection: 'column',
			width: '100%',
			height: '100%',
			background: '#141211',
			color: '#fff5e6',
			padding: '46px 66px',
			fontFamily: 'Plex',
			borderTop: '8px solid #edae45',
			position: 'relative',
		}}
	>
		<div
			style={{
				position: 'absolute',
				right: -80,
				top: 90,
				width: 390,
				height: 390,
				border: '1px solid #664626',
				transform: 'rotate(30deg)',
				background: '#1e1914',
			}}
		/>
		<div
			style={{
				position: 'absolute',
				right: -10,
				top: 170,
				width: 250,
				height: 250,
				border: '1px solid #976a32',
				transform: 'rotate(30deg)',
				background: '#2b2117',
			}}
		/>
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
			}}
		>
			{/* biome-ignore lint/performance/noImgElement: drawn into a PNG by Satori, not rendered in a browser. */}
			<img
				alt="BedrockNexus"
				height={140}
				src={`data:image/png;base64,${logo.toString('base64')}`}
				style={{ marginLeft: -28, marginTop: -18 }}
				width={349}
			/>
			<div style={{ fontSize: 20, color: '#d5b98e', letterSpacing: 3 }}>
				FOR MINECRAFT BEDROCK
			</div>
		</div>
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				marginTop: 6,
				fontFamily: 'Chakra',
				fontWeight: 700,
				fontSize: 84,
				lineHeight: 1.05,
				letterSpacing: -2,
			}}
		>
			<div>Find your</div>
			<div style={{ color: '#ffc968' }}>next world.</div>
		</div>
		<div style={{ fontSize: 27, color: '#c8c0b4', marginTop: 24 }}>
			Play together. Make it yours. Share what you create.
		</div>
		<div
			style={{
				display: 'flex',
				marginTop: 'auto',
				borderTop: '1px solid #48392b',
				paddingTop: 24,
				alignItems: 'center',
				justifyContent: 'space-between',
			}}
		>
			<div style={{ fontSize: 22, color: '#eee1ce' }}>
				Servers · Add-ons · Resource packs · Plugins
			</div>
			<div style={{ fontSize: 22, color: '#ffc968' }}>
				bedrocknexus.com
			</div>
		</div>
	</div>,
	{
		width: 1200,
		height: 630,
		fonts: [
			{ name: 'Chakra', data: display, weight: 700, style: 'normal' },
			{ name: 'Plex', data: body, weight: 400, style: 'normal' },
		],
	},
)
await writeFile(
	new URL('../public/images/bedrocknexus-social-v1.png', import.meta.url),
	Buffer.from(await image.arrayBuffer()),
)
console.log('Generated public/images/bedrocknexus-social-v1.png (1200 × 630).')
