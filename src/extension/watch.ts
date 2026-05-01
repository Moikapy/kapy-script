/**
 * File watcher — re-run on .kapy file changes
 */

import { watch } from "fs";
import { dirname, resolve } from "path";

export function watchAndRun(filePath: string, runCallback: (file: string) => void): void {
	const absolutePath = resolve(filePath);
	let lastRun = 0;

	const debouncedRun = () => {
		const now = Date.now();
		if (now - lastRun < 300) return;
		lastRun = now;
		console.clear();
		console.log(`🔄 Re-running ${filePath}...\n`);
		try {
			runCallback(filePath);
		} catch (error: any) {
			console.error(`Error: ${error.message}`);
		}
	};

	// Initial run
	runCallback(filePath);
	console.log(`\n👀 Watching ${filePath} for changes... (Ctrl+C to stop)`);

	// Watch the file's directory
	const dir = dirname(absolutePath);
	let watcher: ReturnType<typeof watch> | null = null;

	try {
		watcher = watch(dir, (event, filename) => {
			if (filename && filename.endsWith(".kapy")) {
				debouncedRun();
			}
		});
	} catch (error) {
		console.error(`Warning: File watching not available. ${error instanceof Error ? error.message : error}`);
	}

	process.on("SIGINT", () => {
		console.log("\n\n👋 Stopped watching.");
		watcher?.close();
		process.exit(0);
	});
}