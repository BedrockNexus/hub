# Storage And CDN

Bedrock Nexus uses two Cloudflare R2 buckets. Bucket separation is the security
boundary; object prefixes are only organization.

## Production Buckets

| Bucket | Access | Contents |
| --- | --- | --- |
| `bedrocknexus-prod` | Public through `cdn.bedrocknexus.com` | Site media, server and project images, and validated project downloads |
| `bedrocknexus-uploads-prod` | Private | New project release uploads waiting for validation or publication |

Do not attach a public custom domain or enable the `r2.dev` URL on the uploads
bucket. Existing public objects under `artifacts/` remain supported and do not
need an immediate migration.

## Object Keys

```text
media/{entityType}/{entityId}/{kind}/{assetId}.{ext}
uploads/projects/{projectId}/releases/{releaseId}/{artifactId}.{ext}
downloads/projects/{projectId}/releases/{version}/{artifactId}.{ext}
```

New release uploads go to the private `uploads/` namespace. After validation
and project publication, Hub copies the artifact to the public `downloads/`
namespace with immutable cache headers and removes the private object. When a
project is unpublished, Hub copies the artifact back to its private key before
removing the CDN object. The tracked application download route still records
the download before redirecting to the permanent CDN URL.

## Cloudflare Setup

1. Keep `bedrocknexus-prod` public and connect the custom domain
   `cdn.bedrocknexus.com`.
2. Create `bedrocknexus-uploads-prod` as a private bucket with no public domain.
3. Give one R2 API token Object Read and Object Write access to both buckets.
   Cross-bucket release promotion and demotion require access to both.
4. Configure CORS on both buckets for the exact production and local Hub
   origins. Hub uploads public media and private release artifacts directly with
   presigned `PUT` URLs, so both buckets need browser upload CORS.
5. Add an object lifecycle rule to expire abandoned `uploads/` objects after
   one day. Convex cleanup remains responsible for deleting tracked objects.
6. Add the private R2 signed-URL hostname to the validator's
   `ARTIFACT_ALLOWED_HOSTS`. Do not add the CDN hostname unless the validator
   also needs to inspect legacy public artifacts.
7. Deploy the root-only CDN Worker with `bun run cdn:deploy`. Its exact
   `cdn.bedrocknexus.com/` route returns a JSON `404`; R2 continues to serve all
   object paths directly. See `infrastructure/cdn-root/README.md`.

Use this CORS policy on both buckets. Remove the `www` origin if that hostname
does not serve Hub:

```json
[
  {
    "AllowedOrigins": [
      "https://bedrocknexus.com",
      "https://www.bedrocknexus.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Convex Environment

```text
R2_ENDPOINT=https://{account-id}.r2.cloudflarestorage.com
R2_CDN_BUCKET=bedrocknexus-prod
R2_UPLOADS_BUCKET=bedrocknexus-uploads-prod
R2_CDN_PUBLIC_URL=https://cdn.bedrocknexus.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

`R2_BUCKET` remains a temporary fallback for the public bucket in code, but new
deployments should use `R2_CDN_BUCKET` explicitly.

## Rollout Check

After setting the buckets and Convex variables, verify this sequence in
production:

1. Upload a release and confirm it exists only in the private bucket.
2. Confirm the validator can read its signed URL.
3. Publish the project and confirm the artifact moves to `downloads/` in the
   public bucket.
4. Download through Hub and confirm the counter increments before the CDN
   redirect.
5. Unpublish and republish the project, confirming the object moves between
   buckets each time.
6. Delete the release and project, confirming no tracked objects remain.
