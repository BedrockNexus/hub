import { AddServerForm } from '@/components/user-dashboard/servers/add-server-form'
import { getSiteFeatures } from '@/lib/site-settings'

export default async function AddServerPage() {
	const features = await getSiteFeatures()
	return <AddServerForm showPlugins={features.pluginsEnabled} />
}
