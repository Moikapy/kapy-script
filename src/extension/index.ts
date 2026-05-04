/**
 * kapy-script — Extension for @moikapy/kapy CLI
 *
 * Registers the kapy-script language commands:
 *   kapy run <file>        Compile and execute a .kapy file
 *   kapy run --watch <file> Re-run on file changes
 *   kapy check <file>      Parse and type-check a .kapy file
 *   kapy test [path]        Run test declarations
 *   kapy init <name>        Scaffold a new kapy-script project
 *   kapy repl               Interactive REPL
 *
 * Install:
 *   kapy install @moikapy/kapy-script
 *
 * Or in kapy.pkg:
 *   extensions:
 *     - @moikapy/kapy-script
 */

import type { KapyExtensionAPI } from "@moikapy/kapy";
import { runCommand } from "./commands/run.js";
import { checkCommand } from "./commands/check.js";
import { testCommand } from "./commands/test.js";
import { initCommand } from "./commands/init.js";
import { replCommand } from "./commands/repl.js";

export const meta = {
	name: "@moikapy/kapy-script",
	version: "0.1.0",
	description: "The AI-native programming language. Compile, run, and test .kapy files.",
	dependencies: [],
	permissions: ["fs", "network"],
};

export async function register(api: KapyExtensionAPI): Promise<undefined | (() => void)> {
	// ── kapy run ──
	api.addCommand("run", {
		description: "Compile and execute a .kapy file",
		args: [
			{ name: "file", required: true, description: "Path to .kapy file" },
		],
		flags: {
			watch: { type: "boolean", alias: "w", description: "Re-run on file changes", default: false },
		},
	}, runCommand);

	// ── kapy check ──
	api.addCommand("check", {
		description: "Parse and type-check a .kapy file",
		args: [
			{ name: "file", required: true, description: "Path to .kapy file" },
		],
	}, checkCommand);

	// ── kapy test ──
	api.addCommand("test", {
		description: "Run test declarations in .kapy files",
		args: [
			{ name: "path", required: false, description: "File or directory to test (default: current dir)" },
		],
	}, testCommand);

	// ── kapy init ──
	api.addCommand("init", {
		description: "Scaffold a new kapy-script project",
		args: [
			{ name: "name", required: true, description: "Project name" },
		],
	}, initCommand);

	// ── kapy repl ──
	api.addCommand("repl", {
		description: "Start an interactive kapy-script REPL",
	}, replCommand);

	// No teardown needed
	return undefined;
}