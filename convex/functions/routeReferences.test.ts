import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import { createTest, insertProject, insertRelease, insertServer, signIn } from '../test.setup'

describe('listing reference resolution', () => {
 it.each([['addon','a_'],['resource_pack','rp_']] as const)('resolves %s IDs while preserving publication and ownership checks',async(type,prefix)=>{
  const t=createTest()
  const owner=await signIn(t,'owner')
  const outsider=await signIn(t,'outsider')
  const id=await insertProject(t,{type,slug:'old-name',ownerId:owner.userId,createdBy:owner.userId})
  await insertRelease(t,id,'1.0.0')
  const ref=prefix+id
  expect(await t.query(api.functions.projects.projects.getPublishedBySlug,{slug:ref})).toMatchObject({_id:id})
  expect(await t.query(api.functions.projects.versions.getPublicByVersion,{slug:ref,version:'1.0.0'})).toBeTruthy()
  expect(await owner.query(api.functions.projects.projects.getForEdit,{id:ref})).toMatchObject({_id:id})
  expect(await outsider.query(api.functions.projects.projects.getForEdit,{id:ref})).toBeNull()
  expect(await t.query(api.functions.projects.projects.getPublishedBySlug,{slug:(prefix==='a_'?'rp_':'a_')+id})).toBeNull()
  await t.run(ctx=>ctx.db.patch('projects',id,{name:'New name',slug:'new-name',status:'draft'}))
  expect(await t.query(api.functions.projects.projects.getPublishedBySlug,{slug:ref})).toBeNull()
  expect(await owner.query(api.functions.projects.projects.getForEdit,{id:ref})).toMatchObject({_id:id,slug:'new-name'})
  await t.run(ctx=>ctx.db.patch('projects',id,{status:'published'}))
  expect(await t.query(api.functions.projects.projects.getPublishedBySlug,{slug:ref})).toMatchObject({_id:id,slug:'new-name'})
  expect(await t.query(api.functions.projects.projects.getPublishedBySlug,{slug:'new-name'})).toMatchObject({_id:id})
 })
 it('resolves server domains and ports, old IDs and slugs, without exposing drafts',async()=>{
  const t=createTest()
  const owner=await signIn(t,'server-owner')
  const outsider=await signIn(t,'server-outsider')
  const first=await insertServer(t,{slug:'first',ownerId:owner.userId})
  const second=await insertServer(t,{slug:'second',ownerId:owner.userId})
  await t.run(async ctx=>{
   await ctx.db.patch('servers',first,{ipAddress:'play.test.com',port:19132})
   await ctx.db.patch('servers',second,{ipAddress:'play.test.com',port:19133,addressKey:'play.test.com:19133'})
  })
  for(const slug of ['play.test.com','first',first]) expect(await t.query(api.functions.servers.servers.getPublishedBySlug,{slug})).toMatchObject({_id:first})
  expect(await t.query(api.functions.servers.servers.getPublishedBySlug,{slug:'play.test.com:19133'})).toMatchObject({_id:second})
  expect(await owner.query(api.functions.servers.servers.getForEdit,{id:'play.test.com'})).toMatchObject({_id:first})
  expect(await outsider.query(api.functions.servers.servers.getForEdit,{id:'play.test.com'})).toBeNull()
  await t.run(ctx=>ctx.db.patch('servers',first,{status:'draft'}))
  expect(await t.query(api.functions.servers.servers.getPublishedBySlug,{slug:'play.test.com'})).toBeNull()
 })
})
