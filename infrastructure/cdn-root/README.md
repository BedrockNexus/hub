# CDN Root Worker

This Worker gives the CDN root a consistent JSON `404` response while all
object paths continue to be served directly by the public R2 bucket.

The route is deliberately exact:

```text
cdn.bedrocknexus.com/
```

Do not change it to `cdn.bedrocknexus.com/*`. A wildcard would put the Worker
in front of every image and project download.

## Deploy

1. Keep `cdn.bedrocknexus.com` connected to the `bedrocknexus-prod` R2 bucket.
2. Authenticate Wrangler with `bunx wrangler login`, or provide a Cloudflare
   API token to the deployment environment.
3. Run `bun run cdn:deploy` from the Hub repository root.
4. Confirm `https://cdn.bedrocknexus.com/` returns a JSON `404`.
5. Confirm an existing CDN object URL still returns the object directly.

The deployment token needs Workers Scripts edit and Workers Routes edit access
for the `bedrocknexus.com` zone. The Worker has no R2 binding and needs no R2
credentials.
