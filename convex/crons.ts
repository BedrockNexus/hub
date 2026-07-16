import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Ping all servers every 5 minutes to update their status
crons.interval(
	'ping-all-servers',
	{ minutes: 5 },
	internal.functions.servers.status.pingAllServers,
)

crons.daily(
	'cleanup-stale-r2-uploads',
	{ hourUTC: 3, minuteUTC: 0 },
	internal.functions.storage.cleanupStaleManagedR2Uploads,
	{},
)

export default crons
