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
	MAP_GAME_MODE_LABELS,
	MAP_GAME_MODES,
	type MapGameMode,
	RESOURCE_PACK_CONTENT_LABELS,
	RESOURCE_PACK_CONTENT_TYPES,
	RESOURCE_PACK_RESOLUTIONS,
	type ResourcePackContentType,
	type ResourcePackResolution,
	SKIN_CHARACTER_CATEGORIES,
	SKIN_CHARACTER_CATEGORY_LABELS,
	type SkinCharacterCategory,
} from '@/lib/project-metadata'

export interface ProjectTypeFilterValues {
	addonExperiments: 'all' | 'required' | 'not_required'
	mapGameMode: 'all' | MapGameMode
	mapMultiplayer: 'all' | 'supported' | 'single_player'
	resourcePackResolution: 'all' | ResourcePackResolution
	resourcePackContentType: 'all' | ResourcePackContentType
	skinCharacterCategory: 'all' | SkinCharacterCategory
}

export const EMPTY_PROJECT_TYPE_FILTERS: ProjectTypeFilterValues = {
	addonExperiments: 'all',
	mapGameMode: 'all',
	mapMultiplayer: 'all',
	resourcePackResolution: 'all',
	resourcePackContentType: 'all',
	skinCharacterCategory: 'all',
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

function mapMultiplayerLabel(value: ProjectTypeFilterValues['mapMultiplayer']) {
	if (value === 'supported') {
		return 'Multiplayer'
	}
	if (value === 'single_player') {
		return 'Single-player'
	}
	return 'Any player count'
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

	if (type === 'map') {
		return (
			<>
				<Select
					onValueChange={(value) =>
						onChange(
							'mapGameMode',
							value as ProjectTypeFilterValues['mapGameMode'],
						)
					}
					value={filters.mapGameMode}
				>
					<SelectTrigger className="w-full sm:w-auto">
						<SelectValue>
							{filters.mapGameMode === 'all'
								? 'Any game mode'
								: MAP_GAME_MODE_LABELS[filters.mapGameMode]}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any game mode</SelectItem>
						{MAP_GAME_MODES.map((mode) => (
							<SelectItem key={mode} value={mode}>
								{MAP_GAME_MODE_LABELS[mode]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					onValueChange={(value) =>
						onChange(
							'mapMultiplayer',
							value as ProjectTypeFilterValues['mapMultiplayer'],
						)
					}
					value={filters.mapMultiplayer}
				>
					<SelectTrigger className="w-full sm:w-auto">
						<SelectValue>
							{mapMultiplayerLabel(filters.mapMultiplayer)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any player count</SelectItem>
						<SelectItem value="supported">Multiplayer</SelectItem>
						<SelectItem value="single_player">
							Single-player
						</SelectItem>
					</SelectContent>
				</Select>
			</>
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

	if (type === 'skin') {
		return (
			<Select
				onValueChange={(value) =>
					onChange(
						'skinCharacterCategory',
						value as ProjectTypeFilterValues['skinCharacterCategory'],
					)
				}
				value={filters.skinCharacterCategory}
			>
				<SelectTrigger className="w-full sm:w-auto">
					<SelectValue>
						{filters.skinCharacterCategory === 'all'
							? 'Any character'
							: SKIN_CHARACTER_CATEGORY_LABELS[
									filters.skinCharacterCategory
								]}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Any character</SelectItem>
					{SKIN_CHARACTER_CATEGORIES.map((category) => (
						<SelectItem key={category} value={category}>
							{SKIN_CHARACTER_CATEGORY_LABELS[category]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		)
	}

	return null
}
