import {
	Alert01Icon,
	Briefcase as BriefcaseData,
	CalendarIcon as CalendarIconData,
	Check as CheckData,
	ChevronDown as ChevronDownData,
	ChevronLeft as ChevronLeftData,
	ChevronRight as ChevronRightData,
	ChevronUp as ChevronUpData,
	ChevronsLeft as ChevronsLeftData,
	ChevronsRight as ChevronsRightData,
	ChevronsUpDown as ChevronsUpDownData,
	Clock as ClockData,
	Copy as CopyData,
	Eye as EyeData,
	EyeOff as EyeOffData,
	FileArchive as FileArchiveData,
	FileAudioIcon as FileAudioData,
	FileCode as FileCodeData,
	FileIcon as FileData,
	FileText as FileTextData,
	FileVideoIcon as FileVideoData,
	Filter as FilterData,
	Link2 as LinkData,
	LogOut as LogOutData,
	Monitor as MonitorData,
	Moon as MoonData,
	PackageIcon as PackageData,
	Palette as PaletteData,
	Pencil as PencilData,
	Plug as PlugData,
	PlusSignCircleIcon,
	Search as SearchData,
	SearchIcon as SearchIconData,
	Send as SendData,
	Settings as SettingsData,
	Settings2 as Settings2Data,
	Smartphone as SmartphoneData,
	Star as StarData,
	Sun as SunData,
	Trash2 as TrashData,
	Unlink as UnlinkData,
	Upload as UploadData,
	User02Icon,
	UserPlus as UserPlusData,
	X as XData,
	XCircle as XCircleData,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { forwardRef, type ComponentProps } from 'react'

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, 'icon'>

function createIcon(icon: IconSvgElement) {
	return forwardRef<SVGSVGElement, IconProps>(function Icon(props, ref) {
		return <HugeiconsIcon {...props} icon={icon} ref={ref} />
	})
}

export const Briefcase = createIcon(BriefcaseData)
export const CalendarIcon = createIcon(CalendarIconData)
export const Check = createIcon(CheckData)
export const ChevronDown = createIcon(ChevronDownData)
export const ChevronDownIcon = ChevronDown
export const ChevronLeft = createIcon(ChevronLeftData)
export const ChevronRight = createIcon(ChevronRightData)
export const ChevronUp = createIcon(ChevronUpData)
export const ChevronsLeft = createIcon(ChevronsLeftData)
export const ChevronsRight = createIcon(ChevronsRightData)
export const ChevronsUpDown = createIcon(ChevronsUpDownData)
export const Clock = createIcon(ClockData)
export const Copy = createIcon(CopyData)
export const Eye = createIcon(EyeData)
export const EyeOff = createIcon(EyeOffData)
export const FileArchiveIcon = createIcon(FileArchiveData)
export const FileAudioIcon = createIcon(FileAudioData)
export const FileCodeIcon = createIcon(FileCodeData)
export const FileCogIcon = createIcon(Settings2Data)
export const FileIcon = createIcon(FileData)
export const FileTextIcon = createIcon(FileTextData)
export const FileVideoIcon = createIcon(FileVideoData)
export const Filter = createIcon(FilterData)
export const Link2 = createIcon(LinkData)
export const Link2Off = createIcon(UnlinkData)
export const LogOut = createIcon(LogOutData)
export const Monitor = createIcon(MonitorData)
export const Moon = createIcon(MoonData)
export const PackageIcon = createIcon(PackageData)
export const PaletteIcon = createIcon(PaletteData)
export const Pencil = createIcon(PencilData)
export const Plug = createIcon(PlugData)
export const PlusCircle = createIcon(PlusSignCircleIcon)
export const Search = createIcon(SearchData)
export const SearchIcon = createIcon(SearchIconData)
export const Send = createIcon(SendData)
export const Settings = createIcon(SettingsData)
export const Settings2 = createIcon(Settings2Data)
export const Smartphone = createIcon(SmartphoneData)
export const Star = createIcon(StarData)
export const Sun = createIcon(SunData)
export const Trash2 = createIcon(TrashData)
export const TriangleAlert = createIcon(Alert01Icon)
export const Upload = createIcon(UploadData)
export const User2 = createIcon(User02Icon)
export const UserPlus = createIcon(UserPlusData)
export const X = createIcon(XData)
export const XCircle = createIcon(XCircleData)
