import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../_generated/api'
import { createTest } from '../test.setup'

afterEach(() => vi.unstubAllEnvs())
describe('development demo seed', () => {
 it('refuses every deployment except the designated development database', async () => {
  vi.stubEnv('CONVEX_CLOUD_URL', 'https://production.convex.cloud')
  const t = createTest()
  await expect(t.mutation(internal.devSeed.seed, {})).rejects.toThrow('development')
 })
 it('creates public version histories and skips existing demo listings on reruns', async () => {
  vi.stubEnv('CONVEX_CLOUD_URL', 'https://original-crocodile-504.convex.cloud')
  const t = createTest()
  const first = await t.mutation(internal.devSeed.seed, {})
  expect(first.created).toBe(11)
  expect(first.listings).toHaveLength(11)
  const second = await t.mutation(internal.devSeed.seed, {})
  expect(second.created).toBe(0)
  expect(second.listings).toEqual(first.listings)
  const plugin = await t.query(api.functions.plugins.catalog.getProject, { slug: 'demo-nexus-essentials' })
  expect(plugin?.versions).toHaveLength(3)
  expect(plugin?.versions[0].version).toBe('1.2.0')
  expect(plugin?.project.creator?.username).toBe('nexus-demo-studio')
  const addon = await t.query(api.functions.projects.projects.getPublishedBySlug, { slug: 'demo-wildfrontier' })
  expect(addon?.type).toBe('addon')
  expect(addon).not.toBeNull()
  if (!addon) throw new Error('Missing demo addon')
  const versions = await t.query(api.functions.projects.versions.listPublic, { projectId: addon._id })
  expect(versions).toHaveLength(3)
  expect(versions[0].changelog).toContain('Demo data')
  const pack = await t.query(api.functions.projects.projects.getPublishedBySlug, { slug: 'demo-soft-pixels' })
  expect(pack?.type).toBe('resource_pack')
 })
})
