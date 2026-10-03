/**
 * Auth requests reach Convex through the Next.js `/api/auth` proxy, but the
 * Convex site URL is also publicly reachable, so forwarding headers such as
 * `X-Forwarded-For` cannot be trusted there. The proxy stamps the client
 * address it resolved together with AUTH_PROXY_SECRET; Convex only honours
 * the address header when the secret matches and strips both otherwise.
 * Better Auth rate limits by AUTH_CLIENT_IP_HEADER (see convex/auth.ts).
 */
export const AUTH_CLIENT_IP_HEADER = 'x-bedrocknexus-client-ip'
export const AUTH_PROXY_SECRET_HEADER = 'x-bedrocknexus-proxy-secret'
