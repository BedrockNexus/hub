# Content Security Policy

Every page gets a per-request policy from `proxy.ts`
(`buildContentSecurityPolicy`). Other security headers are set for every
response in `next.config.ts`.

| Directive | Allows | Why |
| --- | --- | --- |
| `script-src` | This request's nonce + `'strict-dynamic'` | Only Next.js and next-themes scripts run; injected markup, inline handlers, and `javascript:` links are blocked. |
| `style-src` | `'self' 'unsafe-inline'` | Base UI positioning and the MDX editor use style attributes, which nonces cannot cover. |
| `img-src`, `media-src` | `'self'`, `data:`, `blob:`, any `https:` | CDN media, presigned R2 links, avatars, and editor audio/video. |
| `connect-src` | `'self'`, the Convex deployment (HTTPS + WebSocket), the public status API, `*.r2.cloudflarestorage.com` | Live queries, the server ping tool, and presigned uploads. Derived from `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and `NEXT_PUBLIC_API_URL`. |
| `frame-src` | `https://www.youtube-nocookie.com` | YouTube embeds in rich text (always the privacy-enhanced domain). |
| `frame-ancestors`, `object-src`, `base-uri`, `form-action` | none / none / self / self | No framing of the site, no plugins, no base or form hijacking. |

Nonces require dynamic rendering. All hub pages are dynamic; keep them that
way (no static or ISR pages that emit scripts).

Adding a third-party script, analytics, embed, or API origin means adding it
to `buildContentSecurityPolicy`; otherwise the browser blocks it and logs a
`securitypolicyviolation` in the console. The smoke suite
(`bun run test:e2e`) checks that every script carries the nonce and that
injected handlers do not run.
