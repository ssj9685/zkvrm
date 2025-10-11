import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: LogLevel[] = ["error", "warn", "info", "debug"];

const logFilePath = (() => {
	const explicit = process.env.LOG_FILE ?? process.env.SERVER_LOG_FILE;
	const trimmedExplicit = explicit?.trim();
	const candidate =
		trimmedExplicit && trimmedExplicit.length > 0
			? trimmedExplicit
			: "logs/zkvrm.log";
	const absolute = resolve(process.cwd(), candidate);

	mkdirSync(dirname(absolute), { recursive: true });
	return absolute;
})();

const fileLevel = resolveLevel(process.env.LOG_LEVEL ?? "info");
const consoleLevel = resolveLevel(
	process.env.CONSOLE_LOG_LEVEL ?? process.env.LOG_CONSOLE_LEVEL ?? "warn",
);

const fileSink = createWriteStream(logFilePath, {
	flags: "a",
	encoding: "utf8",
	highWaterMark: 32 * 1024,
});

let fileSinkHealthy = true;

fileSink.on("error", (error) => {
	fileSinkHealthy = false;
	console.error("[logger] Failed to write to log file:", error);
});

export const logger = {
	filePath: logFilePath,
	info(message: string, metadata?: unknown) {
		writeLog("info", message, metadata);
	},
	warn(message: string, metadata?: unknown) {
		writeLog("warn", message, metadata);
	},
	error(message: string, metadata?: unknown) {
		writeLog("error", message, metadata);
	},
	debug(message: string, metadata?: unknown) {
		writeLog("debug", message, metadata);
	},
};

export function writeLog(level: LogLevel, message: string, metadata?: unknown) {
	const timestamp = new Date().toISOString();
	const formatted = formatLine(timestamp, level, message, metadata);

	if (shouldLog(level, fileLevel) && fileSinkHealthy) {
		fileSink.write(`${formatted}\n`);
	}

	if (shouldLog(level, consoleLevel)) {
		const method =
			level === "error"
				? console.error
				: level === "warn"
					? console.warn
					: console.log;
		method(formatted);
	}
}

function formatLine(
	timestamp: string,
	level: LogLevel,
	message: string,
	metadata?: unknown,
) {
	const base = `${timestamp} ${level.toUpperCase()} ${message}`;
	if (metadata === undefined || metadata === null) {
		return base;
	}

	if (metadata instanceof Error) {
		const stack = metadata.stack ? `\n${metadata.stack}` : "";
		return `${base} | ${metadata.name}: ${metadata.message}${stack}`;
	}

	if (typeof metadata === "object") {
		try {
			return `${base} | ${JSON.stringify(metadata)}`;
		} catch {
			return `${base} | [metadata:unserialisable]`;
		}
	}

	return `${base} | ${String(metadata)}`;
}

function shouldLog(level: LogLevel, threshold: LogLevel) {
	return levelIndex(level) <= levelIndex(threshold);
}

function levelIndex(level: LogLevel) {
	const index = LEVEL_ORDER.indexOf(level);
	return index === -1 ? LEVEL_ORDER.indexOf("info") : index;
}

function resolveLevel(raw: string): LogLevel {
	const normalised = raw.toLowerCase() as LogLevel;
	if (LEVEL_ORDER.includes(normalised)) {
		return normalised;
	}

	console.warn(`[logger] Invalid log level '${raw}', falling back to 'info'.`);
	return "info";
}
