import Image from 'next/image'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'

export interface ComparedField {
	key: string
	label: string
	kind: 'text' | 'description' | 'image' | 'gallery' | 'release'
	before: string | null
	after: string | null
}
export interface Comparison {
	firstSubmission: boolean
	fields: ComparedField[]
}
const WORD_BOUNDARY = /([a-z])([A-Z])/g
const FIRST_CHARACTER = /^./
function humanLabel(key: string) {
	return key
		.replace(WORD_BOUNDARY, '$1 $2')
		.replaceAll('_', ' ')
		.replace(FIRST_CHARACTER, (text) => text.toUpperCase())
}
function keyedValues(values: unknown[]) {
	const counts = new Map<string, number>()
	return values.map((item) => {
		const identity = JSON.stringify(item) ?? String(item)
		const occurrence = (counts.get(identity) ?? 0) + 1
		counts.set(identity, occurrence)
		return { item, key: `${identity}-${occurrence}` }
	})
}
function changeLabel(field: ComparedField) {
	if (field.before === null) {
		return 'Added'
	}
	if (field.after === null) {
		return 'Removed'
	}
	return 'Changed'
}
function StructuredValue({ value }: { value: unknown }) {
	if (value === null || value === undefined || value === '') {
		return <span className="text-muted-foreground">Not provided</span>
	}
	if (typeof value === 'boolean') {
		return <span>{value ? 'Yes' : 'No'}</span>
	}
	if (Array.isArray(value)) {
		return (
			<ul className="space-y-1">
				{keyedValues(value).map(({ item, key }) => (
					<li key={key}>
						<StructuredValue value={item} />
					</li>
				))}
			</ul>
		)
	}
	if (typeof value === 'object') {
		return (
			<dl className="space-y-3">
				{Object.entries(value).map(([key, item]) => (
					<div key={key}>
						<dt className="font-medium text-muted-foreground text-xs">
							{humanLabel(key)}
						</dt>
						<dd>
							{key === 'changelog' && typeof item === 'string' ? (
								<RichTextViewer content={item} />
							) : (
								<StructuredValue value={item} />
							)}
						</dd>
					</div>
				))}
			</dl>
		)
	}
	return (
		<span className="whitespace-pre-wrap break-words">{String(value)}</span>
	)
}
function FieldValue({
	field,
	value,
}: {
	field: ComparedField
	value: string | null
}) {
	if (value === null) {
		return <p className="text-muted-foreground text-sm">Not provided</p>
	}
	if (field.kind === 'description') {
		return <RichTextViewer content={value} />
	}
	if (field.kind === 'image') {
		return (
			<Image
				alt={`${field.label} preview`}
				className="max-h-48 w-auto rounded-md border object-contain"
				height={300}
				src={value}
				width={600}
			/>
		)
	}
	if (field.kind === 'gallery') {
		const images = JSON.parse(value) as {
			url: string
			fileName: string
			caption?: string
		}[]
		return (
			<GalleryGrid
				emptyDescription="No gallery images in this version."
				emptyTitle="No images"
				items={images.map((row, index) => ({
					...row,
					_id: `${index}-${row.fileName}`,
				}))}
			/>
		)
	}
	if (field.kind === 'release' || field.key === 'metadata') {
		return <StructuredValue value={JSON.parse(value)} />
	}
	return <p className="whitespace-pre-wrap break-words text-sm">{value}</p>
}
function ComparedValues({
	field,
	firstSubmission,
}: {
	field: ComparedField
	firstSubmission: boolean
}) {
	return (
		<div className="grid gap-px bg-border md:grid-cols-2">
			<section
				aria-label={`Approved ${field.label}`}
				className="min-w-0 space-y-2 bg-card px-4.5 py-3.5"
			>
				<h4 className="text-muted-foreground text-xs uppercase tracking-wide">
					{firstSubmission ? 'No approved listing yet' : 'Approved'}
				</h4>
				<div className="text-muted-foreground">
					<FieldValue field={field} value={field.before} />
				</div>
			</section>
			<section
				aria-label={`Submitted ${field.label}`}
				className="min-w-0 space-y-2 bg-card px-4.5 py-3.5"
			>
				<h4 className="text-primary text-xs uppercase tracking-wide">
					Submitted
				</h4>
				<FieldValue field={field} value={field.after} />
			</section>
		</div>
	)
}

/** Long values start folded, so short changes stay in view. */
function isLong(field: ComparedField) {
	return (
		['description', 'gallery', 'release'].includes(field.kind) ||
		field.key === 'metadata'
	)
}

function FieldTitle({ field }: { field: ComparedField }) {
	return (
		<span className="flex items-center gap-2.5 font-semibold text-[15px]">
			{field.label}
			<span className="rounded bg-muted px-2 py-px font-normal text-muted-foreground text-xs">
				{changeLabel(field)}
			</span>
		</span>
	)
}

export function SubmissionComparison({
	comparison,
}: {
	comparison: Comparison
}) {
	if (comparison.fields.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No listing details changed in this submission.
			</p>
		)
	}
	return (
		<div className="flex flex-col gap-4">
			{comparison.fields.map((field) =>
				isLong(field) ? (
					<details
						className="group overflow-hidden rounded-lg border bg-card"
						key={field.key}
					>
						<summary className="flex min-h-13 cursor-pointer items-center justify-between gap-3 px-4.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
							<FieldTitle field={field} />
							<span className="text-[13.5px] text-primary group-open:hidden">
								Compare
							</span>
							<span className="hidden text-[13.5px] text-primary group-open:inline">
								Hide
							</span>
						</summary>
						<div className="border-t">
							<ComparedValues
								field={field}
								firstSubmission={comparison.firstSubmission}
							/>
						</div>
					</details>
				) : (
					<section
						className="overflow-hidden rounded-lg border bg-card"
						key={field.key}
					>
						<div className="border-b px-4.5 py-3.5">
							<FieldTitle field={field} />
						</div>
						<ComparedValues
							field={field}
							firstSubmission={comparison.firstSubmission}
						/>
					</section>
				),
			)}
		</div>
	)
}
