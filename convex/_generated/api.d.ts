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
import type * as functions_plugins_accountDeletion from "../functions/plugins/accountDeletion.js";
import type * as functions_plugins_catalog from "../functions/plugins/catalog.js";
import type * as functions_plugins_deletion from "../functions/plugins/deletion.js";
import type * as functions_plugins_downloads from "../functions/plugins/downloads.js";
import type * as functions_plugins_github_actions from "../functions/plugins/github/actions.js";
import type * as functions_plugins_github_installations from "../functions/plugins/github/installations.js";
import type * as functions_plugins_github_lib_app from "../functions/plugins/github/lib/app.js";
import type * as functions_plugins_github_validators from "../functions/plugins/github/validators.js";
import type * as functions_plugins_github_webhookHttp from "../functions/plugins/github/webhookHttp.js";
import type * as functions_plugins_github_webhookPayload from "../functions/plugins/github/webhookPayload.js";
import type * as functions_plugins_github_webhookSignature from "../functions/plugins/github/webhookSignature.js";
import type * as functions_plugins_github_webhooks from "../functions/plugins/github/webhooks.js";
import type * as functions_plugins_organizations from "../functions/plugins/organizations.js";
import type * as functions_plugins_projects from "../functions/plugins/projects.js";
import type * as functions_plugins_publishing_actions from "../functions/plugins/publishing/actions.js";
import type * as functions_plugins_publishing_model from "../functions/plugins/publishing/model.js";
import type * as functions_plugins_workflowTemplates from "../functions/plugins/workflowTemplates.js";
import type * as functions_projects_artifactDelivery from "../functions/projects/artifactDelivery.js";
import type * as functions_projects_artifactValidation from "../functions/projects/artifactValidation.js";
import type * as functions_projects_categories from "../functions/projects/categories.js";
import type * as functions_projects_gallery from "../functions/projects/gallery.js";
import type * as functions_projects_index from "../functions/projects/index.js";
import type * as functions_projects_migrations from "../functions/projects/migrations.js";
import type * as functions_projects_projects from "../functions/projects/projects.js";
import type * as functions_projects_reviews from "../functions/projects/reviews.js";
import type * as functions_projects_versions from "../functions/projects/versions.js";
import type * as functions_servers_categories from "../functions/servers/categories.js";
import type * as functions_servers_gallery from "../functions/servers/gallery.js";
import type * as functions_servers_index from "../functions/servers/index.js";
import type * as functions_servers_migrations from "../functions/servers/migrations.js";
import type * as functions_servers_reviews from "../functions/servers/reviews.js";
import type * as functions_servers_servers from "../functions/servers/servers.js";
import type * as functions_servers_software from "../functions/servers/software.js";
import type * as functions_servers_status from "../functions/servers/status.js";
import type * as functions_servers_verification from "../functions/servers/verification.js";
import type * as functions_site_aggregates from "../functions/site/aggregates.js";
import type * as functions_site_audit from "../functions/site/audit.js";
import type * as functions_site_creators from "../functions/site/creators.js";
import type * as functions_site_favourites from "../functions/site/favourites.js";
import type * as functions_site_gameVersions from "../functions/site/gameVersions.js";
import type * as functions_site_index from "../functions/site/index.js";
import type * as functions_site_migrations from "../functions/site/migrations.js";
import type * as functions_site_organizations from "../functions/site/organizations.js";
import type * as functions_site_settings from "../functions/site/settings.js";
import type * as functions_site_support from "../functions/site/support.js";
import type * as functions_site_trending from "../functions/site/trending.js";
import type * as functions_site_users from "../functions/site/users.js";
import type * as functions_storage from "../functions/storage.js";
import type * as functions_storageMigrations from "../functions/storageMigrations.js";
import type * as http from "../http.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authProxy from "../lib/authProxy.js";
import type * as lib_categoryCounts from "../lib/categoryCounts.js";
import type * as lib_contentOwnership from "../lib/contentOwnership.js";
import type * as lib_contentValidation from "../lib/contentValidation.js";
import type * as lib_contentVisibility from "../lib/contentVisibility.js";
import type * as lib_creatorListings from "../lib/creatorListings.js";
import type * as lib_dataUrls from "../lib/dataUrls.js";
import type * as lib_dayKeys from "../lib/dayKeys.js";
import type * as lib_discovery from "../lib/discovery.js";
import type * as lib_editorMedia from "../lib/editorMedia.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_gallery from "../lib/gallery.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_ownerPictures from "../lib/ownerPictures.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_plugins_access from "../lib/plugins/access.js";
import type * as lib_plugins_aggregates from "../lib/plugins/aggregates.js";
import type * as lib_plugins_authorization from "../lib/plugins/authorization.js";
import type * as lib_plugins_buildProvenance from "../lib/plugins/buildProvenance.js";
import type * as lib_plugins_downloadCounts from "../lib/plugins/downloadCounts.js";
import type * as lib_plugins_rateLimits from "../lib/plugins/rateLimits.js";
import type * as lib_plugins_slugs from "../lib/plugins/slugs.js";
import type * as lib_plugins_workflowTemplates from "../lib/plugins/workflowTemplates.js";
import type * as lib_projectReleases from "../lib/projectReleases.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as lib_r2Keys from "../lib/r2Keys.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_redact from "../lib/redact.js";
import type * as lib_serverAddress from "../lib/serverAddress.js";
import type * as lib_siteAggregates from "../lib/siteAggregates.js";
import type * as lib_trending from "../lib/trending.js";
import type * as schemas_plugins from "../schemas/plugins.js";
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
  "functions/plugins/accountDeletion": typeof functions_plugins_accountDeletion;
  "functions/plugins/catalog": typeof functions_plugins_catalog;
  "functions/plugins/deletion": typeof functions_plugins_deletion;
  "functions/plugins/downloads": typeof functions_plugins_downloads;
  "functions/plugins/github/actions": typeof functions_plugins_github_actions;
  "functions/plugins/github/installations": typeof functions_plugins_github_installations;
  "functions/plugins/github/lib/app": typeof functions_plugins_github_lib_app;
  "functions/plugins/github/validators": typeof functions_plugins_github_validators;
  "functions/plugins/github/webhookHttp": typeof functions_plugins_github_webhookHttp;
  "functions/plugins/github/webhookPayload": typeof functions_plugins_github_webhookPayload;
  "functions/plugins/github/webhookSignature": typeof functions_plugins_github_webhookSignature;
  "functions/plugins/github/webhooks": typeof functions_plugins_github_webhooks;
  "functions/plugins/organizations": typeof functions_plugins_organizations;
  "functions/plugins/projects": typeof functions_plugins_projects;
  "functions/plugins/publishing/actions": typeof functions_plugins_publishing_actions;
  "functions/plugins/publishing/model": typeof functions_plugins_publishing_model;
  "functions/plugins/workflowTemplates": typeof functions_plugins_workflowTemplates;
  "functions/projects/artifactDelivery": typeof functions_projects_artifactDelivery;
  "functions/projects/artifactValidation": typeof functions_projects_artifactValidation;
  "functions/projects/categories": typeof functions_projects_categories;
  "functions/projects/gallery": typeof functions_projects_gallery;
  "functions/projects/index": typeof functions_projects_index;
  "functions/projects/migrations": typeof functions_projects_migrations;
  "functions/projects/projects": typeof functions_projects_projects;
  "functions/projects/reviews": typeof functions_projects_reviews;
  "functions/projects/versions": typeof functions_projects_versions;
  "functions/servers/categories": typeof functions_servers_categories;
  "functions/servers/gallery": typeof functions_servers_gallery;
  "functions/servers/index": typeof functions_servers_index;
  "functions/servers/migrations": typeof functions_servers_migrations;
  "functions/servers/reviews": typeof functions_servers_reviews;
  "functions/servers/servers": typeof functions_servers_servers;
  "functions/servers/software": typeof functions_servers_software;
  "functions/servers/status": typeof functions_servers_status;
  "functions/servers/verification": typeof functions_servers_verification;
  "functions/site/aggregates": typeof functions_site_aggregates;
  "functions/site/audit": typeof functions_site_audit;
  "functions/site/creators": typeof functions_site_creators;
  "functions/site/favourites": typeof functions_site_favourites;
  "functions/site/gameVersions": typeof functions_site_gameVersions;
  "functions/site/index": typeof functions_site_index;
  "functions/site/migrations": typeof functions_site_migrations;
  "functions/site/organizations": typeof functions_site_organizations;
  "functions/site/settings": typeof functions_site_settings;
  "functions/site/support": typeof functions_site_support;
  "functions/site/trending": typeof functions_site_trending;
  "functions/site/users": typeof functions_site_users;
  "functions/storage": typeof functions_storage;
  "functions/storageMigrations": typeof functions_storageMigrations;
  http: typeof http;
  "lib/activity": typeof lib_activity;
  "lib/audit": typeof lib_audit;
  "lib/authProxy": typeof lib_authProxy;
  "lib/categoryCounts": typeof lib_categoryCounts;
  "lib/contentOwnership": typeof lib_contentOwnership;
  "lib/contentValidation": typeof lib_contentValidation;
  "lib/contentVisibility": typeof lib_contentVisibility;
  "lib/creatorListings": typeof lib_creatorListings;
  "lib/dataUrls": typeof lib_dataUrls;
  "lib/dayKeys": typeof lib_dayKeys;
  "lib/discovery": typeof lib_discovery;
  "lib/editorMedia": typeof lib_editorMedia;
  "lib/functions": typeof lib_functions;
  "lib/gallery": typeof lib_gallery;
  "lib/media": typeof lib_media;
  "lib/ownerPictures": typeof lib_ownerPictures;
  "lib/permissions": typeof lib_permissions;
  "lib/plugins/access": typeof lib_plugins_access;
  "lib/plugins/aggregates": typeof lib_plugins_aggregates;
  "lib/plugins/authorization": typeof lib_plugins_authorization;
  "lib/plugins/buildProvenance": typeof lib_plugins_buildProvenance;
  "lib/plugins/downloadCounts": typeof lib_plugins_downloadCounts;
  "lib/plugins/rateLimits": typeof lib_plugins_rateLimits;
  "lib/plugins/slugs": typeof lib_plugins_slugs;
  "lib/plugins/workflowTemplates": typeof lib_plugins_workflowTemplates;
  "lib/projectReleases": typeof lib_projectReleases;
  "lib/r2": typeof lib_r2;
  "lib/r2Keys": typeof lib_r2Keys;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/redact": typeof lib_redact;
  "lib/serverAddress": typeof lib_serverAddress;
  "lib/siteAggregates": typeof lib_siteAggregates;
  "lib/trending": typeof lib_trending;
  "schemas/plugins": typeof schemas_plugins;
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
  pluginsBySoftware: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"pluginsBySoftware">;
  pluginsByOwner: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"pluginsByOwner">;
  pluginDownloadCounts: import("@convex-dev/sharded-counter/_generated/component.js").ComponentApi<"pluginDownloadCounts">;
  pluginOwnerDownloadCounts: import("@convex-dev/sharded-counter/_generated/component.js").ComponentApi<"pluginOwnerDownloadCounts">;
};
