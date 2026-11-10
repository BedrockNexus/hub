# Discord listing announcements

The integration announces the first publication of a server, add-on, resource
pack or plugin. It is disabled unless both Convex deployment variables are set:

- `DISCORD_ANNOUNCEMENTS_WEBHOOK_URL`: the secret HTTPS `discord.com` webhook URL
  for the destination channel. Keep it out of Git and client environment values.
- `DISCORD_ANNOUNCEMENTS_ENABLED=true`: enables staging and delivery for future
  first publications. Keep this unset in development and automated testing.

Messages use the deployment's `SITE_URL`, with `https://bedrocknexus.com` as the
fallback. Announcements use the BedrockNexus avatar and gold embed accent, with
an announcement label, linked listing title, summary, and publication timestamp.
Available listing icons appear as thumbnails and banners as wide artwork. Server
addresses, release versions, and plugin server software appear as compact fields.
Artwork uses permanent public CDN URLs; unavailable artwork is omitted rather
than adding expiring private URLs. Mentions remain disabled, including
`@everyone` and role mentions.

## Publication rules

- A server is staged at its first publication and waits for moderator approval.
- Add-ons and resource packs wait for approval and an available CDN release.
- A plugin is staged after its first approved build has reached the CDN and its
  public listing has been published.
- Edits, new versions and republishing do not create another first-publication
  announcement. Existing listings are not backfilled when the feature is enabled.

The worker rechecks publication, approval and release availability when claiming
a delivery. Unpublished, rejected or deleted listings do not pass that check.
A listing can still change after that check while the HTTP request is in flight.
An announcement already delivered to Discord is not automatically edited or
deleted when the website listing changes.

## Delivery behavior

`discordAnnouncements` is an internal delivery outbox keyed by listing type and
ID. It stores status, attempts, nonsecret errors and the Discord message ID.
It never stores the webhook URL. Staging and scheduler writes happen in the same
transaction as publication. A failed Discord request does not roll back the
listing's publication.

Only one worker can claim a delivery lease at a time. A scheduled watchdog
recovers interrupted workers. HTTP 429 honors Discord's `retry_after` or
`Retry-After`; network failures and 5xx responses use bounded backoff. Delivery
stops after five attempts. Other 4xx responses fail immediately. Inspect failed
outbox rows after correcting configuration; no public retry endpoint is exposed.

Normal repeated events and completed deliveries are deduplicated. Discord does
not provide a webhook idempotency key: a connection lost after Discord accepts
the message, but before the sender records success, can cause a retry to post
another message. The outbox does not promise exactly-once external delivery.

Disabling the feature skips queued delivery attempts and prevents staging new
ones. Re-enabling it does not replay skipped items or previously published
listings. HTTP requests are restricted to Discord webhook endpoints and do not
follow redirects. Response/network error text is not persisted or logged, to
avoid exposing the URL's token.

## Verification

Unit/function tests cover publication gates, delayed artifact availability,
deduplication, disabled configuration, rate limiting, bounded retries and worker
recovery. Live Discord delivery requires an explicitly approved new publication
or a separately authorized test message. Do not fabricate a public listing just
to test the channel.
