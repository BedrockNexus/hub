import { validateBuildCommandOverride } from '../build-command'
import type {
	BuildSystem,
	GeneratedWorkflow,
	WorkflowGenerationInput,
} from '../types'
import {
	assertValidGeneratedWorkflow,
	releaseSteps,
	WORKFLOW_PATH,
	workflowHeader,
} from '../workflow'

function defaultBuildCommand(buildSystem: BuildSystem) {
	if (buildSystem === 'gradle') {
		return 'if [ -x ./gradlew ]; then ./gradlew --no-daemon clean build; else gradle --no-daemon clean build; fi'
	}
	if (buildSystem === 'maven') {
		return 'if [ -x ./mvnw ]; then ./mvnw --batch-mode --no-transfer-progress clean package; else mvn --batch-mode --no-transfer-progress clean package; fi'
	}
	throw new Error('PowerNukkitX projects must use Gradle or Maven.')
}

function wrapperPreparation(buildSystem: BuildSystem) {
	return buildSystem === 'gradle'
		? `if [ -f gradlew ]; then
            chmod +x gradlew
          fi`
		: `if [ -f mvnw ]; then
            chmod +x mvnw
          fi`
}

export function generatePowerNukkitXWorkflow(
	input: WorkflowGenerationInput,
): GeneratedWorkflow {
	if (input.metadata.buildSystem === 'composer') {
		throw new Error('PowerNukkitX projects cannot use Composer.')
	}

	const buildSystem = input.metadata.buildSystem
	const buildCommand =
		validateBuildCommandOverride(
			'powernukkitx',
			input.buildCommandOverride,
		) ?? defaultBuildCommand(buildSystem)
	const safePackageName = input.metadata.name.replace(
		/[^A-Za-z0-9._-]+/g,
		'-',
	)
	const output = `dist/${safePackageName}.jar`
	const cache = buildSystem
	const content = `${workflowHeader()}      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"
          cache: ${cache}
      - name: Build PowerNukkitX plugin
        run: |
          set -euo pipefail
          ${wrapperPreparation(buildSystem)}
          ${buildCommand}
      - name: Select primary plugin JAR
        run: |
          set -euo pipefail
          mkdir -p dist
          mapfile -t jars < <(
            find build/libs target -maxdepth 2 -type f -name "*.jar" \\
              ! -name "*-sources.jar" \\
              ! -name "*-javadoc.jar" \\
              ! -name "*-tests.jar" \\
              ! -name "*-test.jar" \\
              ! -name "*-plain.jar" \\
              ! -name "original-*.jar" \\
              2>/dev/null | sort
          )
          if [ "\${#jars[@]}" -ne 1 ]; then
            printf "Expected exactly one primary plugin JAR, found %s:\\n" "\${#jars[@]}" >&2
            printf " - %s\\n" "\${jars[@]:-none}" >&2
            exit 1
          fi
          cp "\${jars[0]}" "${output}"
          test -s "${output}"
${releaseSteps(output)}`

	return assertValidGeneratedWorkflow({
		path: WORKFLOW_PATH,
		content,
		buildCommand,
		releaseAssetPattern: output,
	})
}
