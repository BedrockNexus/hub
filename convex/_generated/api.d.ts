/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as functions_email from "../functions/email.js";
import type * as functions_projects_categories from "../functions/projects/categories.js";
import type * as functions_projects_gallery from "../functions/projects/gallery.js";
import type * as functions_projects_index from "../functions/projects/index.js";
import type * as functions_projects_projects from "../functions/projects/projects.js";
import type * as functions_projects_reviews from "../functions/projects/reviews.js";
import type * as functions_projects_versions from "../functions/projects/versions.js";
import type * as functions_servers_categories from "../functions/servers/categories.js";
import type * as functions_servers_gallery from "../functions/servers/gallery.js";
import type * as functions_servers_index from "../functions/servers/index.js";
import type * as functions_servers_reviews from "../functions/servers/reviews.js";
import type * as functions_servers_servers from "../functions/servers/servers.js";
import type * as functions_servers_status from "../functions/servers/status.js";
import type * as functions_servers_verification from "../functions/servers/verification.js";
import type * as functions_site_activity from "../functions/site/activity.js";
import type * as functions_site_analytics from "../functions/site/analytics.js";
import type * as functions_site_favourites from "../functions/site/favourites.js";
import type * as functions_site_gameVersions from "../functions/site/gameVersions.js";
import type * as functions_site_index from "../functions/site/index.js";
import type * as functions_site_organizations from "../functions/site/organizations.js";
import type * as functions_site_settings from "../functions/site/settings.js";
import type * as functions_site_support from "../functions/site/support.js";
import type * as functions_site_users from "../functions/site/users.js";
import type * as functions_storage from "../functions/storage.js";
import type * as http from "../http.js";
import type * as lib_contentVisibility from "../lib/contentVisibility.js";
import type * as lib_gallery from "../lib/gallery.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as lib_r2Keys from "../lib/r2Keys.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as schemas_projects from "../schemas/projects.js";
import type * as schemas_servers from "../schemas/servers.js";
import type * as schemas_site from "../schemas/site.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  "functions/email": typeof functions_email;
  "functions/projects/categories": typeof functions_projects_categories;
  "functions/projects/gallery": typeof functions_projects_gallery;
  "functions/projects/index": typeof functions_projects_index;
  "functions/projects/projects": typeof functions_projects_projects;
  "functions/projects/reviews": typeof functions_projects_reviews;
  "functions/projects/versions": typeof functions_projects_versions;
  "functions/servers/categories": typeof functions_servers_categories;
  "functions/servers/gallery": typeof functions_servers_gallery;
  "functions/servers/index": typeof functions_servers_index;
  "functions/servers/reviews": typeof functions_servers_reviews;
  "functions/servers/servers": typeof functions_servers_servers;
  "functions/servers/status": typeof functions_servers_status;
  "functions/servers/verification": typeof functions_servers_verification;
  "functions/site/activity": typeof functions_site_activity;
  "functions/site/analytics": typeof functions_site_analytics;
  "functions/site/favourites": typeof functions_site_favourites;
  "functions/site/gameVersions": typeof functions_site_gameVersions;
  "functions/site/index": typeof functions_site_index;
  "functions/site/organizations": typeof functions_site_organizations;
  "functions/site/settings": typeof functions_site_settings;
  "functions/site/support": typeof functions_site_support;
  "functions/site/users": typeof functions_site_users;
  "functions/storage": typeof functions_storage;
  http: typeof http;
  "lib/contentVisibility": typeof lib_contentVisibility;
  "lib/gallery": typeof lib_gallery;
  "lib/r2": typeof lib_r2;
  "lib/r2Keys": typeof lib_r2Keys;
  "lib/rateLimits": typeof lib_rateLimits;
  "schemas/projects": typeof schemas_projects;
  "schemas/servers": typeof schemas_servers;
  "schemas/site": typeof schemas_site;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
