import {
	AdminRouteNotFoundState,
	MODERATION_HOME,
} from '@/components/admin-dashboard/admin-route-state'

export default function ModerationNotFound() {
	return <AdminRouteNotFoundState home={MODERATION_HOME} />
}
