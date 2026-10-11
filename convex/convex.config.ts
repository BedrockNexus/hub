import { defineApp } from 'convex/server'
import aggregate from '@convex-dev/aggregate/convex.config.js'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'
import shardedCounter from '@convex-dev/sharded-counter/convex.config.js'
import resend from '@convex-dev/resend/convex.config.js'
import r2 from '@convex-dev/r2/convex.config.js'
import betterAuth from './betterAuth/convex.config'

const app = defineApp()
app.use(rateLimiter)
app.use(resend)
app.use(r2)
app.use(betterAuth)
// Plugin registry: exact counts and download totals (lib/plugins).
app.use(aggregate, { name: 'pluginsBySoftware' })
app.use(aggregate, { name: 'pluginsByOwner' })
app.use(shardedCounter, { name: 'pluginDownloadCounts' })
app.use(shardedCounter, { name: 'pluginOwnerDownloadCounts' })

export default app
