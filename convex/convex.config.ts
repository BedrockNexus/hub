import { defineApp } from 'convex/server'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'
import resend from '@convex-dev/resend/convex.config.js'
import r2 from '@convex-dev/r2/convex.config.js'
import betterAuth from './betterAuth/convex.config'

const app = defineApp()
app.use(rateLimiter)
app.use(resend)
app.use(r2)
app.use(betterAuth)

export default app
