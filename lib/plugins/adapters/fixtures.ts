import { createRepositorySnapshot } from './repository'

export const pocketMineFixture = createRepositorySnapshot(
	'BedrockNexus/example-php-plugin',
	'main',
	[
		{
			path: 'README.md',
			content:
				'# BedrockNexus Example Plugin\n\nA PocketMine-MP API 5 example.',
		},
		{
			path: 'plugin.yml',
			content: `name: BedrockNexusExample
version: 1.0.0
main: BedrockNexus\\ExamplePlugin\\Main
src-namespace-prefix: BedrockNexus\\ExamplePlugin
api: 5.0.0
author: BedrockNexus
description: An example PocketMine-MP plugin.
website: https://bedrocknexus.com
`,
		},
		{
			path: 'composer.json',
			content: JSON.stringify({
				name: 'bedrocknexus/example-php-plugin',
				description: 'An example PocketMine-MP 5 plugin.',
				type: 'pocketmine-plugin',
				license: 'MIT',
				require: { php: '>=8.1' },
				autoload: {
					'psr-4': { 'BedrockNexus\\ExamplePlugin\\': 'src/' },
				},
			}),
		},
		{
			path: 'src/Main.php',
			content:
				'<?php\nnamespace BedrockNexus\\ExamplePlugin;\nfinal class Main extends PluginBase {}\n',
		},
		{
			path: 'resources/config.yml',
			content: 'message: Welcome\n',
		},
	],
)

export const powerNukkitGradleFixture = createRepositorySnapshot(
	'BedrockNexus/example-powernukkitx-plugin',
	'main',
	[
		{
			path: 'settings.gradle.kts',
			content: 'rootProject.name = "BedrockNexusExample"\n',
		},
		{
			path: 'build.gradle.kts',
			content: `plugins {
  java
}

group = "com.bedrocknexus"
version = "1.0.0"

repositories {
  mavenCentral()
}

dependencies {
  compileOnly("cn.powernukkitx:powernukkitx:2.0.0-SNAPSHOT")
}
`,
		},
		{
			path: 'gradlew',
			content: '#!/usr/bin/env sh\n',
		},
		{
			path: 'src/main/resources/plugin.yml',
			content: `name: BedrockNexusExample
version: 1.0.0
main: com.bedrocknexus.example.BedrockNexusExamplePlugin
api:
  - 2.0.0
author: BedrockNexus
description: An example PowerNukkitX plugin.
website: https://bedrocknexus.com
`,
		},
		{
			path: 'src/main/java/com/bedrocknexus/example/BedrockNexusExamplePlugin.java',
			content:
				'package com.bedrocknexus.example;\npublic final class BedrockNexusExamplePlugin {}\n',
		},
	],
)

export const powerNukkitMavenFixture = createRepositorySnapshot(
	'BedrockNexus/example-powernukkitx-maven-plugin',
	'main',
	[
		{
			path: 'pom.xml',
			content: `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.bedrocknexus</groupId>
  <artifactId>example-powernukkitx-plugin</artifactId>
  <version>1.0.0</version>
  <description>An example PowerNukkitX Maven plugin.</description>
  <dependencies>
    <dependency>
      <groupId>cn.powernukkitx</groupId>
      <artifactId>powernukkitx</artifactId>
      <version>2.0.0-SNAPSHOT</version>
      <scope>provided</scope>
    </dependency>
  </dependencies>
</project>
`,
		},
		{
			path: 'mvnw',
			content: '#!/usr/bin/env sh\n',
		},
		{
			path: 'src/main/resources/plugin.yml',
			content: `name: BedrockNexusMavenExample
version: 1.0.0
main: com.bedrocknexus.maven.Main
api: 2.0.0
authors:
  - BedrockNexus
`,
		},
		{
			path: 'src/main/java/com/bedrocknexus/maven/Main.java',
			content:
				'package com.bedrocknexus.maven;\npublic final class Main {}\n',
		},
	],
)

export const unsupportedFixture = createRepositorySnapshot(
	'BedrockNexus/readme-only',
	'main',
	[
		{
			path: 'README.md',
			content: '# Not a plugin\n',
		},
	],
)

export const ambiguousFixture = createRepositorySnapshot(
	'BedrockNexus/ambiguous-plugin',
	'main',
	[...pocketMineFixture.files, ...powerNukkitGradleFixture.files],
)
