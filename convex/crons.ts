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

crons.daily(
	'cleanup-expired-server-verifications',
	{ hourUTC: 3, minuteUTC: 30 },
	internal.functions.servers.verification.cleanupExpired,
	{},
)

// Homepage counters, right after each round of status checks has landed.
crons.interval(
	'refresh-site-aggregates',
	{ minutes: 5 },
	internal.functions.site.aggregates.refresh,
	{},
)

crons.interval(
	'recompute-project-trending',
	{ hours: 1 },
	internal.functions.site.trending.recomputeProjects,
	{},
)

crons.interval(
	'recompute-server-trending',
	{ hours: 1 },
	internal.functions.site.trending.recomputeServers,
	{},
)

crons.cron(
	'purge-server-status-history',
	'15 4 * * *',
	internal.functions.servers.status.purgeStatusHistory,
	{},
)

export default crons
