import { R2 } from '@convex-dev/r2'
import { components } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'
import { authComponent } from '../auth'

export const r2 = new R2(components.r2)

/**
 * Client-callable mutations for R2 uploads.
 * `syncMetadata` is called by the client after a direct PUT upload completes.
 */
export const { syncMetadata } = r2.clientApi<DataModel>({
	checkUpload: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to upload files')
		}
	},
})
