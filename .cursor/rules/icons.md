# Icon Conventions

## Always Use HugeIcons

This project uses **HugeIcons** (`@hugeicons/core-free-icons`) instead of Lucide icons.

### Import Pattern

```tsx
import { IconName } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
```

### Usage Pattern

**IMPORTANT:** HugeIcons are SVG objects, NOT React components. They must be used with the `HugeiconsIcon` wrapper:

```tsx
<HugeiconsIcon icon={IconName} size={16} />

// With className:
<HugeiconsIcon icon={IconName} size={16} className="text-muted-foreground" />
```

**❌ WRONG - This will NOT work:**
```tsx
<IconName className="size-4" />
```

### Icon Type for Props

When defining props that accept an icon, use this pattern:
```tsx
import { DiscordIcon } from "@hugeicons/core-free-icons";

type HugeIcon = typeof DiscordIcon;

interface Props {
  icon: HugeIcon;
}
```

**❌ WRONG - IconType does NOT exist in @hugeicons/react:**
```tsx
import type { IconType } from "@hugeicons/react"; // This doesn't exist!
```

## Common Icon Mappings (Lucide → HugeIcons)

| Lucide Icon | HugeIcon Equivalent |
|-------------|---------------------|
| `House` | `Home01Icon` |
| `Server` | `ServerStack03Icon` |
| `Building2` | `Building06Icon` |
| `Settings`, `Settings2` | `Settings01Icon` |
| `ChartPie` | `ChartIcon` |
| `LayoutDashboard` | `DashboardSpeed01Icon` |
| `FolderTree` | `FolderLibraryIcon` |
| `Package` | `Package01Icon` |
| `Users` | `UserGroupIcon` |
| `BarChart3` | `Analytics01Icon` |
| `ArrowLeft` | `ArrowLeft01Icon` |
| `ChevronRight` | `ArrowRight01Icon` |
| `ChevronDown` | `ArrowDown01Icon` |
| `ChevronUp` | `ArrowUp01Icon` |
| `X`, `Cancel` | `Cancel01Icon` |
| `Check` | `Tick02Icon` |
| `Search` | `SearchIcon` |
| `Upload` | `Upload03Icon` |
| `Download` | `Download03Icon` |
| `Trash`, `Delete` | `Delete02Icon` |
| `Edit`, `Pencil` | `PencilEdit01Icon` |
| `Plus` | `Add01Icon` |
| `Minus` | `MinusSignIcon` |
| `Menu` | `Menu01Icon` |
| `MoreHorizontal` | `MoreHorizontalCircle01Icon` |
| `Eye` | `View01Icon` |
| `EyeOff` | `ViewOffIcon` |
| `Copy` | `Copy01Icon` |
| `ExternalLink` | `Link01Icon` |
| `AlertCircle` | `Alert02Icon` |
| `Info` | `InformationCircleIcon` |
| `CheckCircle` | `CheckmarkCircle02Icon` |
| `XCircle` | `MultiplicationSignCircleIcon` |
| `Loader` | `Loading03Icon` |
| `Mail` | `Mail01Icon` |
| `User` | `User01Icon` |
| `Lock` | `LockIcon` |
| `LogOut` | `Logout01Icon` |
| `LogIn` | `Login01Icon` |

## Social Icons

Social icons are available in HugeIcons:
- `DiscordIcon`
- `YoutubeIcon`
- `InstagramIcon`
- `BlueskyIcon`
- `TiktokIcon`
- `TwitterIcon` / `NewTwitterIcon`
- `FacebookIcon`
- `GithubIcon`
- `LinkedinIcon`

## Remember

- **NEVER** use `lucide-react` for new code
- Always import from `@hugeicons/core-free-icons`
- Use `@hugeicons/react` for the `HugeiconsIcon` wrapper component
- Icon names typically follow the pattern: `NameXXIcon` (e.g., `Home01Icon`, `Settings01Icon`)
