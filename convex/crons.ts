import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
	'refresh-plugin-workflow-catalog',
	{ minutes: 15 },
	internal.functions.plugins.workflowCatalog.refreshScheduled,
	{},
)

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

// Order of /creators and /organizations (lib/creatorRank.ts).
crons.interval(
	'recompute-creator-ranks',
	{ hours: 1 },
	internal.functions.site.creators.recomputeRanks,
	{},
)

// Notification email digests (functions/social/digest.ts), 15:00 UTC.
crons.cron(
	'send-daily-notification-digests',
	'0 15 * * *',
	internal.functions.social.digest.queue,
	{ frequency: 'daily' },
)

crons.cron(
	'send-weekly-notification-digests',
	'0 15 * * 1',
	internal.functions.social.digest.queue,
	{ frequency: 'weekly' },
)

crons.cron(
	'purge-old-notifications',
	'45 4 * * *',
	internal.functions.social.notifications.purgeOld,
	{},
)

crons.cron(
	'purge-old-download-events',
	'0 5 * * *',
	internal.functions.site.downloadLog.purgeOld,
	{},
)

// Server health scores (functions/servers/intelligence.ts), after the day
// rolls over in UTC.
crons.cron(
	'recompute-server-health',
	'20 0 * * *',
	internal.functions.servers.intelligence.recomputeHealth,
	{},
)

crons.cron(
	'purge-server-intelligence',
	'30 4 * * *',
	internal.functions.servers.status.purgeServerIntelligence,
	{},
)

crons.cron(
	'purge-server-status-history',
	'15 4 * * *',
	internal.functions.servers.status.purgeStatusHistory,
	{},
)

export default crons
