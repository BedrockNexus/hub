import { recordSubmission } from './lib/moderationHistory'
import { snapshot } from './lib/submissions'
import { ConvexError, v } from 'convex/values'
import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation } from './_generated/server'
import { syncProjectOwners } from './lib/creatorListings'
import { ensureProjectStats, syncProject } from './lib/discovery'
import { insertProjectAggregates } from './lib/plugins/aggregates'
import { projectReference } from '../lib/content-reference'
import { createPluginDashboardId } from '../lib/plugins/plugin-dashboard-id'

const DEV_URL = 'https://original-crocodile-504.convex.cloud'
const DAY = 86400000
const demoNotice = '**Demo data:** This listing is for interface testing. Download files are placeholders.'
const releaseNotes = [
 '### First release\n\n- Added the core features.\n- Included default configuration and setup documentation.',
 '### Improvements\n\n- Added Minecraft 1.21.100 compatibility.\n- Improved performance on larger worlds.\n- Fixed settings not saving after a restart.',
 '### Latest update\n\n- Added Minecraft 1.21.110 compatibility.\n- Added new customization options.\n- Fixed an issue reported in the previous release.\n\n```yaml\nenabled: true\n```',
]

/** Internal and restricted to this development deployment. Safe to rerun. */
export const seed = internalMutation({
 args: {},
 returns: v.object({ created: v.number(), listings: v.array(v.object({ name: v.string(), path: v.string() })) }),
 handler: async ctx => {
  if (process.env.CONVEX_CLOUD_URL !== DEV_URL) {
   throw new ConvexError('Demo data can only be seeded into original-crocodile-504 (development).')
  }
  const now = Date.now()
  const email = 'nexus-demo-studio@example.invalid'
  let owner = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: 'user', where: [{ field: 'email', value: email }] })
  if (!owner) owner = await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: 'user', data: {
   name: 'Nexus Demo Studio', username: 'nexus-demo-studio', displayUsername: 'Nexus Demo Studio',
   email, emailVerified: false, role: 'user', createdAt: now, updatedAt: now,
  } } })
  const ownerId = String(owner._id)
  const listings: { name: string; path: string }[] = []
  let created = 0

  for (const [index, sample] of [
   { type: 'addon', slug: 'demo-wildfrontier', name: 'Wild Frontier (Demo)', summary: 'New wildlife, forest encounters, and exploration rewards.', tags: ['survival', 'mobs', 'exploration'] },
   { type: 'addon', slug: 'demo-farmstead', name: 'Farmstead (Demo)', summary: 'Expand your farm with seasonal crops and new recipes.', tags: ['farming', 'food', 'survival'] },
   { type: 'addon', slug: 'demo-ancient-ruins', name: 'Ancient Ruins (Demo)', summary: 'Discover forgotten structures and hidden treasure.', tags: ['structures', 'adventure'] },
   { type: 'resource_pack', slug: 'demo-soft-pixels', name: 'Soft Pixels (Demo)', summary: 'Warm 16x textures for a quieter Minecraft world.', tags: ['textures', '16x', 'vanilla'] },
   { type: 'resource_pack', slug: 'demo-obsidian-ui', name: 'Obsidian UI (Demo)', summary: 'A dark, readable interface with refined inventory screens.', tags: ['ui', 'dark'] },
   { type: 'resource_pack', slug: 'demo-clearwater', name: 'Clearwater (Demo)', summary: 'Crisp water, natural foliage, and brighter underwater details.', tags: ['textures', '32x', 'nature'] },
  ].entries()) {
   const type = sample.type as 'addon' | 'resource_pack'
   const existing = await ctx.db.query('projects').withIndex('by_slug', q => q.eq('slug', sample.slug)).unique()
   if (existing && existing.ownerId !== ownerId) throw new Error('Demo slug belongs to another owner')
   let projectId = existing?._id
   if (!projectId) {
    projectId = await ctx.db.insert('projects', {
     type, name: sample.name, slug: sample.slug, summary: sample.summary,
     description: `${demoNotice}\n\n## About ${sample.name}\n\n${sample.summary}\n\n## Features\n\n- Easy setup for Bedrock Edition\n- Configurable options\n- Multiple releases with compatibility information\n\n## Getting started\n\nCheck the Versions tab for compatibility and the Changelog tab for release notes.`,
     categoryIds: [], tags: sample.tags, ownerType: 'user', ownerId, createdBy: ownerId,
     status: 'published', moderationStatus: 'approved', license: 'MIT', publishedAt: now - 60 * DAY,
     metadata: type === 'addon' ? { type: 'addon', behaviorPackIncluded: true, resourcePackIncluded: true, experimentalFeaturesRequired: false, dependencies: [] }
      : { type: 'resource_pack', resolution: index === 5 ? '32x' : '16x', contentTypes: index === 4 ? ['ui'] : ['textures'] },
     updatedAt: now,
    })
    let latestVersionId: Id<'projectVersions'> | undefined
    for (let revision = 0; revision < 3; revision++) {
     const version = ['1.0.0', '1.1.0', '1.2.0'][revision]
     const publishedAt = now - (60 - revision * 28) * DAY
     const key = `demo/projects/${projectId}/${version}/placeholder.${type === 'addon' ? 'mcaddon' : 'mcpack'}`
     latestVersionId = await ctx.db.insert('projectVersions', {
      projectId, version, changelog: `${demoNotice}\n\n${releaseNotes[revision]}`,
      r2Key: key, cdnR2Key: key, fileName: `${sample.slug}-${version}.${type === 'addon' ? 'mcaddon' : 'mcpack'}`,
      fileSize: (index + 1) * 1048576 + revision * 131072,
      validationStatus: 'valid', reviewStatus: 'approved',
      gameVersions: revision === 2 ? ['1.21.110', '1.21.100'] : [revision === 1 ? '1.21.100' : '1.21.90'],
      downloads: (index + 1) * (revision === 2 ? 127 : 613), publishedAt, createdAt: publishedAt,
     })
    }
    await ctx.db.patch('projects', projectId, { latestVersionId, latestVersionString: '1.2.0', latestVersionAt: now - 4 * DAY, versionCount: 3, supportedGameVersions: ['1.21.110', '1.21.100', '1.21.90'] })
    const project = await ctx.db.get('projects', projectId)
    if (!project) throw new Error('Missing demo project')
    await syncProject(ctx, project)
    const stats = await ensureProjectStats(ctx, projectId)
    await ctx.db.patch('projectStats', stats._id, { totalDownloads: (index + 1) * (127 + 2 * 613) })
    await syncProjectOwners(ctx, null, project)
    created++
   }
   listings.push({ name: sample.name, path: `/${type === 'addon' ? 'addons' : 'resource-packs'}/${projectReference(type, projectId)}` })
  }

  let installation = await ctx.db.query('githubInstallations').withIndex('by_installation_id', q => q.eq('installationId', 9000000000)).unique()
  if (!installation) {
   const id = await ctx.db.insert('githubInstallations', { installationId: 9000000000, accountId: 9000000000, accountLogin: 'nexus-demo-studio', accountType: 'User', ownerType: 'user', ownerId, connectedBy: ownerId, status: 'active', createdAt: now, updatedAt: now })
   installation = await ctx.db.get('githubInstallations', id)
  }
  if (!installation) throw new Error('Missing demo installation')
  for (const [index, sample] of [
   { slug: 'demo-nexus-essentials', name: 'Nexus Essentials (Demo)', summary: 'Homes, warps, and everyday server tools.', software: 'powernukkitx', status: 'published' },
   { slug: 'demo-guardian', name: 'Guardian (Demo)', summary: 'Region protection and configurable build permissions.', software: 'pocketmine-mp', status: 'published' },
   { slug: 'demo-skytrails', name: 'Sky Trails (Demo)', summary: 'Customizable cosmetic trails for your players.', software: 'powernukkitx', status: 'published' },
   { slug: 'demo-marketplace', name: 'Marketplace (Demo)', summary: 'A draft shop plugin for testing admin filters.', software: 'pocketmine-mp', status: 'draft' },
   { slug: 'demo-legacy-chat', name: 'Legacy Chat (Demo)', summary: 'An archived plugin for testing admin filters.', software: 'powernukkitx', status: 'archived' },
  ].entries()) {
   const existing = await ctx.db.query('plugins').withIndex('by_slug', q => q.eq('slug', sample.slug)).unique()
   if (existing && existing.ownerId !== ownerId) throw new Error('Demo slug belongs to another owner')
   const githubRepositoryId = 9000000001 + index
   if (!existing) {
    let software = await ctx.db.query('serverSoftware').withIndex('by_slug', q => q.eq('slug', sample.software)).unique()
    if (!software) {
     const id = await ctx.db.insert('serverSoftware', { slug: sample.software, name: sample.software === 'powernukkitx' ? 'PowerNukkitX' : 'PocketMine-MP', description: 'Bedrock server software', enabled: true, sortOrder: 10, createdAt: now, updatedAt: now })
     software = await ctx.db.get('serverSoftware', id)
    }
    if (!software) throw new Error('Missing software')
    const repositoryId = await ctx.db.insert('githubRepositories', { installationId: installation._id, githubRepositoryId, ownerLogin: 'nexus-demo-studio', name: sample.slug, fullName: `nexus-demo-studio/${sample.slug}`, htmlUrl: `https://example.invalid/demo/${sample.slug}`, defaultBranch: 'main', isPrivate: false, isArchived: sample.status === 'archived', accessStatus: 'granted', createdAt: now, updatedAt: now })
    const projectId = await ctx.db.insert('plugins', { ownerType: 'user', ownerId, createdBy: ownerId, repositoryId, softwareId: software._id, slug: sample.slug, name: sample.name, summary: sample.summary,
     description: `${demoNotice}\n\n## Overview\n\n${sample.summary}\n\n## Commands\n\n| Command | Description |\n| --- | --- |\n| /demo help | Show available commands |\n| /demo settings | Open the settings menu |`,
     searchText: `${sample.name} ${sample.summary} demo`, categoryIds: [], license: 'MIT', visibility: sample.status === 'published' ? 'public' : 'draft', status: sample.status as 'published' | 'draft' | 'archived', downloadCount: 0, ratingAverage: 0, ratingCount: 0, publishedAt: sample.status === 'published' ? now - 60 * DAY : undefined, createdAt: now - 60 * DAY, updatedAt: now,
    })
    let latestVersionId: Id<'pluginVersions'> | undefined
    if (sample.status === 'published') for (let revision = 0; revision < 3; revision++) {
     const version = ['1.0.0', '1.1.0', '1.2.0'][revision]
     const publishedAt = now - (60 - revision * 28) * DAY
     const changelog = `${demoNotice}\n\n${releaseNotes[revision]}`
     const versionId = await ctx.db.insert('pluginVersions', { projectId, version, normalizedVersion: version, changelog, minecraftVersion: ['1.21.90', '1.21.100', '1.21.110'][revision], status: 'published', publishedAt, createdAt: publishedAt, updatedAt: publishedAt })
     const commitSha = String(index * 3 + revision + 1).padStart(40, '0')
     const buildId = await ctx.db.insert('pluginBuilds', { projectId, repositoryId, workflowRunId: 9000000100 + index * 3 + revision, workflowName: 'Demo placeholder build', event: 'push', commitSha, branch: 'main', status: 'completed', conclusion: 'success', logsUrl: 'https://example.invalid/demo/build', artifactId: 9000000200 + index * 3 + revision, traceable: false, completedAt: publishedAt, createdAt: publishedAt, updatedAt: publishedAt })
     const fileName = `${sample.slug}-${version}.${sample.software === 'powernukkitx' ? 'jar' : 'phar'}`
     await ctx.db.insert('pluginReleases', { projectId, repositoryId, buildId, versionId, version, normalizedVersion: version, changelog, commitSha, branch: 'main', traceable: false, status: 'published', fileName, size: 262144 + index * 131072 + revision * 32768, cdnKey: `demo/plugins/${projectId}/${version}/${fileName}`, submittedBy: ownerId, submittedAt: publishedAt, publishedAt, createdAt: publishedAt, updatedAt: publishedAt })
     latestVersionId = versionId
    }
    if (latestVersionId) await ctx.db.patch('plugins', projectId, { latestVersionId })
    const project = await ctx.db.get('plugins', projectId)
    if (!project) throw new Error('Missing demo plugin')
    await insertProjectAggregates(ctx, project)
    created++
   }
   listings.push({ name: sample.name, path: sample.status === 'published' ? `/plugins/${createPluginDashboardId(githubRepositoryId)}` : '/admin/plugins' })
  }
  return { created, listings }
 },
})

export const setupReviewDemo = internalMutation({
 args:{ passwordHash:v.string(),reset:v.optional(v.boolean()) },returns:v.object({ email:v.string(),ids:v.array(v.string()) }),handler:async(ctx,args)=>{
 if(process.env.CONVEX_CLOUD_URL!==DEV_URL) throw new ConvexError('Development only')
 const now=Date.now();const email='nexus-review-admin@example.invalid'
 let admin=await ctx.runQuery(components.betterAuth.adapter.findOne,{ model:'user',where:[{ field:'email',value:email }] })
 if(!admin)admin=await ctx.runMutation(components.betterAuth.adapter.create,{ input:{ model:'user',data:{ name:'Demo Review Admin',username:'nexus-review-admin',email,emailVerified:true,role:'admin',createdAt:now,updatedAt:now } } })
 await ctx.runMutation(components.betterAuth.adapter.updateOne,{ input:{ model:'user',where:[{ field:'_id',value:String(admin._id) }],update:{ role:'admin',emailVerified:true } } })
 const account=await ctx.runQuery(components.betterAuth.adapter.findOne,{ model:'account',where:[{ field:'userId',value:String(admin._id) }] })
 if(!account)await ctx.runMutation(components.betterAuth.adapter.create,{ input:{ model:'account',data:{ accountId:String(admin._id),providerId:'credential',userId:String(admin._id),password:args.passwordHash,createdAt:now,updatedAt:now } } })
 const owner=await ctx.runQuery(components.betterAuth.adapter.findOne,{ model:'user',where:[{ field:'email',value:'nexus-demo-studio@example.invalid' }] });if(!owner)throw new Error('Run seed first')
 await ctx.runMutation(components.betterAuth.adapter.updateOne,{ input:{ model:'user',where:[{ field:'_id',value:String(owner._id) }],update:{ emailVerified:true } } })
 const creatorAccount=await ctx.runQuery(components.betterAuth.adapter.findOne,{ model:'account',where:[{ field:'userId',value:String(owner._id) }] })
 if(!creatorAccount)await ctx.runMutation(components.betterAuth.adapter.create,{ input:{ model:'account',data:{ accountId:String(owner._id),providerId:'credential',userId:String(owner._id),password:args.passwordHash,createdAt:now,updatedAt:now } } })
 const ids:string[]=[]
 for(const type of ['addon','resource_pack'] as const){
 const category=await ctx.db.query('projectCategories').withIndex('by_type',q=>q.eq('projectType',type)).first(); const categoryId=category?._id ?? await ctx.db.insert('projectCategories',{ projectType:type,name:'Demo Gameplay',slug:`demo-gameplay-${type}`,isActive:true,sortOrder:100,createdAt:now,updatedAt:now });
 const slug=`demo-review-${type}`;let item=await ctx.db.query('projects').withIndex('by_slug',q=>q.eq('slug',slug)).first()
 if(!item){ const id=await ctx.db.insert('projects',{ type,name:`Review Demo ${type}`,slug,summary:'Approved demo listing summary',description:'Demo listing for browser moderation testing, with installation instructions and sample features.',categoryIds:[categoryId],ownerType:'user',ownerId:String(owner._id),createdBy:String(owner._id),status:'published',moderationStatus:'approved',publishedAt:now-86400000,updatedAt:now });await ctx.db.insert('projectVersions',{ projectId:id,version:'1.0.0',r2Key:'demo/placeholder.mcpack',fileName:'demo.mcpack',fileSize:100,validationStatus:'valid',reviewStatus:'approved',downloads:0,createdAt:now });item=await ctx.db.get(id) }
 if(!item || item.ownerId!==String(owner._id))throw new Error('Missing fixture or unexpected owner')
 if(!item.submissionStatus || args.reset){ const baseline={...item,summary:'Approved demo listing summary'}; const details={ ...baseline,summary:'Proposed demo listing summary' };await ctx.db.patch(item._id,{ summary:'Approved demo listing summary',status:'published',moderationStatus:'approved',moderationReason:undefined,submissionReason:undefined,draftChangesJson:snapshot(details),submissionStatus:'pending',submissionRevision:(item.submissionRevision ?? 0)+1,submittedAt:now-172800000 });await recordSubmission(ctx,{ content:baseline,details,actorId:String(owner._id),revision:(item.submissionRevision ?? 0)+1 }) }
 ids.push(item._id)
 }
 return { email,ids }
 } })
