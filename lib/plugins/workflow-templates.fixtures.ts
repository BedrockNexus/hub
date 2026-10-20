/** A minimal valid workflow template for tests. Real ones live in the database. */
export const TEST_WORKFLOW_TEMPLATE = `name: BedrockNexus Publish

on:
  push:
    branches:
      - "**"
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: mkdir -p dist && touch dist/{{package_name}}.phar
      - uses: actions/upload-artifact@v4
        with:
          name: plugin-package
          path: dist/{{package_name}}.phar
`
