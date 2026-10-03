# Content permissions

All server and project permission checks go through `convex/lib/permissions.ts`
(pure rules in `convex/lib/contentOwnership.ts`). Do not add new copies.

| Action | User-owned content | Organization-owned content | Site admin |
| --- | --- | --- | --- |
| Edit details, gallery, releases, images | Owner (servers also: original registrant) | Any member | Yes, through admin tools |
| Delete, or move to another owner | Owner | Organization `owner` or `admin` | Yes |
| Create in an organization | — | Any member | — |
| Approve, publish, or review | Never their own: creators, registrants, owners, and members of the owning organization are excluded | | Another admin |

Moving content also requires membership in the destination organization.

Listing input is validated on the server by `convex/lib/contentValidation.ts`
with the same limits as the client forms in `lib/schemas`. Reviews take whole
star ratings from 1 to 5, at most 2,000 characters of text, and cannot be left
on content you are affiliated with.
