import { parse } from 'yaml'

import type { GeneratedWorkflow } from './types'

export const WORKFLOW_PATH =
	'.github/workflows/bedrocknexus-publish.yml' as const

export function shellQuote(value: string) {
	return `'${value.replaceAll("'", "'\"'\"'")}'`
}

export function assertValidGeneratedWorkflow(workflow: GeneratedWorkflow) {
	const parsed = parse(workflow.content) as {
		name?: unknown
		on?: unknown
		jobs?: unknown
	}

	if (parsed.name !== 'BedrockNexus Publish' || !parsed.on || !parsed.jobs) {
		throw new Error(
			'The generated workflow is missing its name, triggers, or jobs.',
		)
	}
	if (!workflow.content.includes("startsWith(github.ref, 'refs/tags/v')")) {
		throw new Error('The generated workflow must gate releases to v* tags.')
	}
	if (!workflow.content.includes('gh release create')) {
		throw new Error(
			'The generated workflow must create a permanent GitHub Release.',
		)
	}
	if (workflow.path !== WORKFLOW_PATH) {
		throw new Error('The generated workflow path is not canonical.')
	}

	return workflow
}

export function releaseSteps(assetPath: string) {
	return `      - name: Upload validation artifact
        uses: actions/upload-artifact@v4
        with:
          name: plugin-package
          path: ${assetPath}
          if-no-files-found: error

  release:
    name: Publish release
    if: startsWith(github.ref, 'refs/tags/v')
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download validated package
        uses: actions/download-artifact@v4
        with:
          name: plugin-package
          path: dist
      - name: Publish GitHub Release
        env:
          GH_TOKEN: \${{ github.token }}
        run: gh release create "\${GITHUB_REF_NAME}" ${assetPath} --generate-notes --verify-tag
`
}

export function workflowHeader() {
	return `# Managed by BedrockNexus Plugins.
name: BedrockNexus Publish

on:
  push:
    branches:
      - "**"
    tags:
      - "v*"
  pull_request:

permissions:
  contents: read

concurrency:
  group: bedrocknexus-publish-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Validate and package
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
`
}
