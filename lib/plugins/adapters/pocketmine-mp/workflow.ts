import { validateBuildCommandOverride } from '../build-command'
import type { GeneratedWorkflow, WorkflowGenerationInput } from '../types'
import {
	assertValidGeneratedWorkflow,
	releaseSteps,
	shellQuote,
	WORKFLOW_PATH,
	workflowHeader,
} from '../workflow'

const DEFAULT_BUILD_COMMAND =
	'if [ -f composer.json ]; then composer validate --no-check-publish && composer install --no-interaction --no-progress --prefer-dist; fi'

export function generatePocketMineWorkflow(
	input: WorkflowGenerationInput,
): GeneratedWorkflow {
	const buildCommand =
		validateBuildCommandOverride(
			'pocketmine-mp',
			input.buildCommandOverride,
		) ?? DEFAULT_BUILD_COMMAND
	const safePackageName = input.metadata.name.replace(
		/[^A-Za-z0-9._-]+/g,
		'-',
	)
	const output = `dist/${safePackageName}.phar`
	const content = `${workflowHeader()}      - name: Set up PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: "8.2"
          tools: composer
      - name: Validate PHP sources and dependencies
        run: |
          set -euo pipefail
          find src -type f -name "*.php" -print0 | xargs -0 -n1 php -l
          ${buildCommand}
      - name: Package PocketMine plugin
        run: |
          set -euo pipefail
          mkdir -p dist
          include_paths=(plugin.yml src)
          for optional_path in resources vendor; do
            if [ -e "\${optional_path}" ]; then
              include_paths+=("\${optional_path}")
            fi
          done
          include_csv=$(IFS=,; echo "\${include_paths[*]}")
          curl --fail --location --retry 3 \\
            https://github.com/pmmp/DevTools/releases/latest/download/DevTools.phar \\
            --output "\${RUNNER_TEMP}/DevTools.phar"
          php -dphar.readonly=0 "\${RUNNER_TEMP}/DevTools.phar" \\
            --make "\${include_csv}" \\
            --relative . \\
            --out "\${RUNNER_TEMP}/${safePackageName}.phar"
          mv "\${RUNNER_TEMP}/${safePackageName}.phar" ${shellQuote(output)}
          test -s ${shellQuote(output)}
${releaseSteps(output)}`

	return assertValidGeneratedWorkflow({
		path: WORKFLOW_PATH,
		content,
		buildCommand,
		releaseAssetPattern: output,
	})
}
