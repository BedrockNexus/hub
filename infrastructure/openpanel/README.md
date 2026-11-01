# Optional Amblydia OpenPanel stack

Prepared for `https://analytics.amblydia.com`, with the collector on `/api`.
Use Coolify's built-in OpenPanel resource for the standard setup. This directory
is an optional custom alternative with a same-origin gateway; it is not required
for the application integration and is not evidence of a running instance.

The stack uses the public OpenPanel 2.x images from the
[official Coolify template](https://github.com/coollabsio/coolify/blob/main/templates/compose/openpanel.yaml).
`upstream.json` records the exact source hash. The top-level current OpenPanel
documentation also describes a supporter-only v3; do not mix its commands,
images or database migration instructions with this stack.

Changes from the template: one Nginx gateway routes `/api/*` to the API with the
prefix stripped, and other paths to the dashboard. Inline Coolify file contents
are real files here. Named volumes are declared for standard Compose validation.
No application or database port is published directly. Coolify terminates TLS.

## Deploy in Coolify

1. Use the Amblydia project and a server with capacity for PostgreSQL, Redis,
   ClickHouse, the OpenPanel API/dashboard/worker, and the gateway. Reserve at
   least 4 GB RAM for this workload and configure storage/backup retention.
2. Create a Docker Compose resource from this directory, preserving all files.
   Assign only the gateway a domain: `https://analytics.amblydia.com:8080` in
   Coolify's service domain editor (8080 is the internal container port).
   Set `OPENPANEL_PUBLIC_URL=https://analytics.amblydia.com` without a port.
3. Use Coolify-generated `SERVICE_USER_POSTGRES`, `SERVICE_PASSWORD_POSTGRES`,
   `SERVICE_PASSWORD_REDIS`, and `SERVICE_BASE64_COOKIESECRET`. Never check real
   values into this repository. Keep database services private.
4. Point the domain's DNS at the selected Coolify ingress. Deploy and wait for
   every service to become healthy. Verify the gateway's public `/healthz`,
   `/api/healthcheck`, and dashboard, including HTTPS and authentication.
5. Bootstrap the owner while access is restricted. Temporarily enable
   `OPENPANEL_ALLOW_REGISTRATION` only for this step if needed, then disable it
   and verify public registration is closed. Set up email before relying on
   password recovery or invitations. No owner account is pre-created here.
6. Create the Amblydia organization and a BedrockNexus project. Add separate
   write clients for browser events (restricted to the website origins) and
   server events (client ID plus secret). Other Amblydia products get separate
   projects and credentials in the same instance.
7. Follow `../../docs/ANALYTICS_AND_DOWNLOADS.md` to configure and verify Hub,
   API, and Convex. Record live acceptance before calling the integration active.

## Operations

Back up PostgreSQL and ClickHouse; Redis persists its queue in a named volume.
Keep copies off the application server and test restoration. Monitor disk usage,
queue health, memory, and collector errors. Record deployed image digests, and
resolve/pin all images to tested digests before a production rollout; the major
and stable tags in this preparation follow the upstream template.
Do not run a volume-removing teardown during an upgrade. Take backups before
database migrations. Telemetry is best effort; official download counts remain
in each product's backend and downloads do not depend on collector availability.
