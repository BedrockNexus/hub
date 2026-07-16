import { z } from 'zod'
import { richTextLength } from '@/lib/rich-text-length'

export const DOMAIN_OR_IP_REGEX =
	/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$/

export const SERVER_LANGUAGE_OPTIONS = [
	'English',
	'Spanish',
	'Portuguese',
	'French',
	'German',
	'Dutch',
	'Italian',
	'Polish',
	'Russian',
	'Japanese',
	'Korean',
	'Chinese',
] as const

export const SERVER_REGION_OPTIONS = [
	'North America',
	'Europe',
	'Asia',
	'South America',
	'Oceania',
	'Africa',
	'Middle East',
] as const

const optionalUrl = z
	.string()
	.url('Please enter a valid URL')
	.optional()
	.or(z.literal(''))

export const serverFormSchema = z.object({
	organizationId: z.string().optional(),
	name: z
		.string()
		.min(3, 'Server name must be at least 3 characters')
		.max(50, 'Server name must be less than 50 characters'),
	smallDescription: z
		.string()
		.min(10, 'Short description must be at least 10 characters')
		.max(150, 'Short description must be less than 150 characters'),
	description: z
		.string()
		.refine(
			(v) => v.trim() === '' || richTextLength(v) >= 50,
			'Description must be at least 50 characters when provided',
		)
		.refine(
			(v) => richTextLength(v) <= 5000,
			'Description must be less than 5000 characters',
		),
	ipAddress: z
		.string()
		.min(1, 'IP address is required')
		.regex(DOMAIN_OR_IP_REGEX, 'Please enter a valid domain or IP address'),
	port: z.coerce
		.number()
		.int()
		.min(1, 'Port must be at least 1')
		.max(65_535, 'Port must be less than 65535')
		.default(19_132),
	categoryIds: z
		.array(z.string())
		.min(1, 'Please select at least one category'),
	website: optionalUrl,
	discordUrl: optionalUrl,
	storeUrl: optionalUrl,
	wikiUrl: optionalUrl,
	region: z.string().optional().or(z.literal('')),
	language: z.array(z.string()),
	gameVersions: z.array(z.string()),
})

export type ServerFormData = z.infer<typeof serverFormSchema>

export const SERVER_FORM_DEFAULTS: ServerFormData = {
	organizationId: undefined,
	name: '',
	smallDescription: '',
	description: '',
	ipAddress: '',
	port: 19_132,
	categoryIds: [],
	website: '',
	discordUrl: '',
	storeUrl: '',
	wikiUrl: '',
	region: '',
	language: [],
	gameVersions: [],
}
