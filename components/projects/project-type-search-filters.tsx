'use client'

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import type { ProjectType } from '@/lib/project-artifacts'
import {
	RESOURCE_PACK_CONTENT_LABELS,
	RESOURCE_PACK_CONTENT_TYPES,
	RESOURCE_PACK_RESOLUTIONS,
	type ResourcePackContentType,
	type ResourcePackResolution,
} from '@/lib/project-metadata'

export interface ProjectTypeFilterValues {
	addonExperiments: 'all' | 'required' | 'not_required'
	resourcePackResolution: 'all' | ResourcePackResolution
	resourcePackContentType: 'all' | ResourcePackContentType
}

export const EMPTY_PROJECT_TYPE_FILTERS: ProjectTypeFilterValues = {
	addonExperiments: 'all',
	resourcePackResolution: 'all',
	resourcePackContentType: 'all',
}

export function hasProjectTypeFilters(filters: ProjectTypeFilterValues) {
	return Object.values(filters).some((value) => value !== 'all')
}

function addonExperimentsLabel(
	value: ProjectTypeFilterValues['addonExperiments'],
) {
	if (value === 'required') {
		return 'Experiments required'
	}
	if (value === 'not_required') {
		return 'No experiments required'
	}
	return 'Any experiments'
}

export function ProjectTypeSearchFilters({
	filters,
	onChange,
	type,
}: {
	filters: ProjectTypeFilterValues
	onChange: <K extends keyof ProjectTypeFilterValues>(
		key: K,
		value: ProjectTypeFilterValues[K],
	) => void
	type: 'all' | ProjectType
}) {
	if (type === 'addon') {
		return (
			<Select
				onValueChange={(value) =>
					onChange(
						'addonExperiments',
						value as ProjectTypeFilterValues['addonExperiments'],
					)
				}
				value={filters.addonExperiments}
			>
				<SelectTrigger className="w-full sm:w-auto">
					<SelectValue>
						{addonExperimentsLabel(filters.addonExperiments)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Any experiments</SelectItem>
					<SelectItem value="required">
						Experiments required
					</SelectItem>
					<SelectItem value="not_required">
						No experiments required
					</SelectItem>
				</SelectContent>
			</Select>
		)
	}

	if (type === 'resource_pack') {
		return (
			<>
				<Select
					onValueChange={(value) =>
						onChange(
							'resourcePackResolution',
							value as ProjectTypeFilterValues['resourcePackResolution'],
						)
					}
					value={filters.resourcePackResolution}
				>
					<SelectTrigger className="w-full sm:w-auto">
						<SelectValue>
							{filters.resourcePackResolution === 'all'
								? 'Any resolution'
								: filters.resourcePackResolution}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any resolution</SelectItem>
						{RESOURCE_PACK_RESOLUTIONS.map((resolution) => (
							<SelectItem key={resolution} value={resolution}>
								{resolution}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					onValueChange={(value) =>
						onChange(
							'resourcePackContentType',
							value as ProjectTypeFilterValues['resourcePackContentType'],
						)
					}
					value={filters.resourcePackContentType}
				>
					<SelectTrigger className="w-full sm:w-auto">
						<SelectValue>
							{filters.resourcePackContentType === 'all'
								? 'Any content'
								: RESOURCE_PACK_CONTENT_LABELS[
										filters.resourcePackContentType
									]}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any content</SelectItem>
						{RESOURCE_PACK_CONTENT_TYPES.map((contentType) => (
							<SelectItem key={contentType} value={contentType}>
								{RESOURCE_PACK_CONTENT_LABELS[contentType]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</>
		)
	}

	return null
}
