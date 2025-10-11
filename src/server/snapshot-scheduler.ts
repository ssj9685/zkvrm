import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { logger } from "@server/logger";

const SQLITE_PATH = process.env.SQLITE_PATH ?? "zkvrm.sqlite";
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_INITIAL_DELAY_MS = 10_000;
const MIN_INTERVAL_MS = 5_000;
const logPrefix = "[db-snapshot]";

class SnapshotInProgressError extends Error {
	constructor() {
		super("A snapshot upload is already in progress.");
		this.name = "SnapshotInProgressError";
	}
}

type DisabledSnapshotConfig = {
	enabled: false;
	reason: string;
};

type EnabledSnapshotConfig = {
	enabled: true;
	bucket: string;
	region: string;
	keyPrefix: string;
	intervalMs: number;
	initialDelayMs: number;
	endpoint?: string;
	forcePathStyle: boolean;
};

type SnapshotConfig = DisabledSnapshotConfig | EnabledSnapshotConfig;

type SnapshotUploadResult = {
	objectKey: string;
	bytes: number;
	durationMs: number;
};

type SnapshotDestination =
	| {
			bucket: string;
			keyPrefix: string;
	  }
	| {
			error: string;
	  };

const snapshotConfig = resolveSnapshotConfig();
const s3Client = snapshotConfig.enabled
	? new S3Client({
			region: snapshotConfig.region,
			endpoint: snapshotConfig.endpoint,
			forcePathStyle: snapshotConfig.forcePathStyle,
		})
	: null;

let hasStarted = false;
let isRunning = false;

export function startDatabaseSnapshotScheduler() {
	if (hasStarted) {
		return;
	}

	hasStarted = true;

	if (!snapshotConfig.enabled) {
		logger.info(`${logPrefix} ${snapshotConfig.reason}`);
		return;
	}

	logger.info(
		`${logPrefix} Enabled. Uploading ${SQLITE_PATH} to s3://${snapshotConfig.bucket}/${snapshotConfig.keyPrefix} every ${formatDuration(snapshotConfig.intervalMs)} (first run in ${formatDuration(snapshotConfig.initialDelayMs)}).`,
	);

	scheduleNext(snapshotConfig.initialDelayMs);
}

function scheduleNext(delay: number) {
	if (!snapshotConfig.enabled) {
		return;
	}

	setTimeout(() => {
		void runScheduledSnapshot();
	}, delay);
}

async function createLocalSnapshot(): Promise<{
	filePath: string;
	tempDir: string;
}> {
	const tempDir = await mkdtemp(join(tmpdir(), "zkvrm-snapshot-"));
	const filePath = join(tempDir, `snapshot-${randomUUID()}.sqlite`);
	const db = new Database(SQLITE_PATH);

	try {
		db.exec(`VACUUM INTO '${escapeSqlitePath(filePath)}'`);
	} finally {
		db.close();
	}

	return { filePath, tempDir };
}

function buildObjectKey(config: EnabledSnapshotConfig) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `${config.keyPrefix}zkvrm-${timestamp}-${randomUUID()}.sqlite`;
}

function escapeSqlitePath(path: string) {
	return path.replace(/'/g, "''");
}

function resolveSnapshotConfig(): SnapshotConfig {
	const destination = resolveSnapshotDestination();
	if ("error" in destination) {
		return { enabled: false, reason: destination.error };
	}

	const { bucket, keyPrefix } = destination;
	const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
	if (!region) {
		return {
			enabled: false,
			reason:
				"S3 snapshots disabled: AWS_REGION or AWS_DEFAULT_REGION must be set.",
		};
	}

	const intervalCandidate =
		resolveInterval("S3_SNAPSHOT_INTERVAL", process.env.S3_SNAPSHOT_INTERVAL) ??
		resolveInterval(
			"S3_SNAPSHOT_INTERVAL_MS",
			process.env.S3_SNAPSHOT_INTERVAL_MS,
		) ??
		DEFAULT_INTERVAL_MS;
	const intervalMs = normaliseInterval(intervalCandidate, DEFAULT_INTERVAL_MS);

	const initialDelayCandidate =
		resolveInterval(
			"S3_SNAPSHOT_INITIAL_DELAY",
			process.env.S3_SNAPSHOT_INITIAL_DELAY,
		) ??
		resolveInterval(
			"S3_SNAPSHOT_INITIAL_DELAY_MS",
			process.env.S3_SNAPSHOT_INITIAL_DELAY_MS,
		);
	const initialDelayMs = normaliseInterval(
		initialDelayCandidate,
		Math.min(intervalMs, DEFAULT_INITIAL_DELAY_MS),
	);

	return {
		enabled: true,
		bucket,
		region,
		keyPrefix,
		intervalMs,
		initialDelayMs,
		endpoint: process.env.S3_SNAPSHOT_ENDPOINT,
		forcePathStyle: process.env.S3_SNAPSHOT_FORCE_PATH_STYLE === "true",
	};
}

function resolveInterval(label: string, rawValue?: string) {
	if (!rawValue) {
		return undefined;
	}

	const parsed = parseDuration(rawValue);
	if (parsed == null) {
		logger.warn(`${logPrefix} Unable to parse ${label} value '${rawValue}'.`);
	}
	return parsed ?? undefined;
}

function normaliseInterval(value: number | undefined, fallback: number) {
	if (value == null) {
		return fallback;
	}

	if (!Number.isFinite(value) || value < MIN_INTERVAL_MS) {
		logger.warn(
			`${logPrefix} Interval ${value}ms is invalid or too small. Using ${fallback}ms instead.`,
		);
		return fallback;
	}

	return value;
}

function normaliseKeyPrefix(rawPrefix?: string) {
	if (!rawPrefix) {
		return "";
	}

	const trimmed = rawPrefix.trim().replace(/^\/+/, "").replace(/\/+$/, "");
	return trimmed.length ? `${trimmed}/` : "";
}

function resolveSnapshotDestination(): SnapshotDestination {
	const uri = process.env.S3_SNAPSHOT_URI ?? process.env.S3_SNAPSHOT_URL;
	const extraPrefix = process.env.S3_SNAPSHOT_PREFIX;

	if (uri) {
		const parsed = parseS3Uri(uri);
		if (!parsed) {
			return {
				error: `S3 snapshots disabled: ${uri} is not a valid S3 URI. Expected format s3://bucket/optional/prefix.`,
			};
		}

		const bucketFromEnv = process.env.S3_SNAPSHOT_BUCKET;
		if (bucketFromEnv && bucketFromEnv !== parsed.bucket) {
			logger.warn(
				`${logPrefix} Ignoring S3_SNAPSHOT_BUCKET='${bucketFromEnv}' because S3_SNAPSHOT_URI sets bucket='${parsed.bucket}'.`,
			);
		}

		const keyPrefix = combinePrefixes(parsed.prefix, extraPrefix);
		return {
			bucket: parsed.bucket,
			keyPrefix,
		};
	}

	const bucket = process.env.S3_SNAPSHOT_BUCKET;
	if (!bucket) {
		return {
			error: "S3 snapshots disabled: S3_SNAPSHOT_BUCKET is not set.",
		};
	}

	return {
		bucket,
		keyPrefix: normaliseKeyPrefix(extraPrefix),
	};
}

function parseDuration(value: string) {
	const normalised = value.trim().toLowerCase();
	const match = normalised.match(/^(\d+)(ms|s|m|h|d)?$/);
	if (!match) {
		return null;
	}

	const amount = Number.parseInt(match[1], 10);
	const unit = match[2] ?? "ms";

	switch (unit) {
		case "ms":
			return amount;
		case "s":
			return amount * 1_000;
		case "m":
			return amount * 60_000;
		case "h":
			return amount * 3_600_000;
		case "d":
			return amount * 86_400_000;
		default:
			return null;
	}
}

function formatDuration(durationMs: number) {
	if (durationMs < 1_000) {
		return `${durationMs}ms`;
	}
	if (durationMs < 60_000) {
		return `${(durationMs / 1_000).toFixed(1)}s`;
	}
	if (durationMs < 3_600_000) {
		return `${(durationMs / 60_000).toFixed(1)}m`;
	}
	if (durationMs < 86_400_000) {
		return `${(durationMs / 3_600_000).toFixed(1)}h`;
	}
	return `${(durationMs / 86_400_000).toFixed(1)}d`;
}

function formatBytes(bytes: number) {
	if (!Number.isFinite(bytes) || bytes === 0) {
		return `${bytes}B`;
	}

	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

function logSuccessfulUpload(
	config: EnabledSnapshotConfig,
	result: SnapshotUploadResult,
) {
	logger.info(
		`${logPrefix} Uploaded s3://${config.bucket}/${result.objectKey} (${formatBytes(result.bytes)}) in ${formatDuration(result.durationMs)}.`,
	);
}

async function runScheduledSnapshot() {
	if (!snapshotConfig.enabled || !s3Client) {
		return;
	}

	try {
		const result = await runSnapshotWithLock(snapshotConfig, s3Client);
		logSuccessfulUpload(snapshotConfig, result);
	} catch (error) {
		if (error instanceof SnapshotInProgressError) {
			logger.warn(
				`${logPrefix} Previous snapshot still in progress; skipping this run.`,
			);
		} else {
			logger.error(`${logPrefix} Failed to upload snapshot`, error);
		}
	} finally {
		scheduleNext(snapshotConfig.intervalMs);
	}
}

export async function uploadDatabaseSnapshotNow(): Promise<SnapshotUploadResult> {
	if (!snapshotConfig.enabled || !s3Client) {
		const reason = snapshotConfig.enabled
			? "S3 snapshots disabled: S3 client failed to initialise."
			: snapshotConfig.reason;
		throw new Error(reason);
	}

	const result = await runSnapshotWithLock(snapshotConfig, s3Client);
	logSuccessfulUpload(snapshotConfig, result);
	return result;
}

async function runSnapshotWithLock(
	config: EnabledSnapshotConfig,
	client: S3Client,
): Promise<SnapshotUploadResult> {
	if (isRunning) {
		throw new SnapshotInProgressError();
	}

	isRunning = true;
	try {
		return await performSnapshotUpload(config, client);
	} finally {
		isRunning = false;
	}
}

async function performSnapshotUpload(
	config: EnabledSnapshotConfig,
	client: S3Client,
): Promise<SnapshotUploadResult> {
	const startedAt = Date.now();
	const { filePath, tempDir } = await createLocalSnapshot();

	try {
		const file = Bun.file(filePath);
		const body = new Uint8Array(await file.arrayBuffer());
		const objectKey = buildObjectKey(config);

		await client.send(
			new PutObjectCommand({
				Bucket: config.bucket,
				Key: objectKey,
				Body: body,
				ContentType: "application/x-sqlite3",
				ContentLength: file.size,
				Metadata: {
					database: SQLITE_PATH,
					"created-at": new Date().toISOString(),
				},
			}),
		);

		return {
			objectKey,
			bytes: file.size,
			durationMs: Date.now() - startedAt,
		};
	} finally {
		await rm(tempDir, { recursive: true, force: true }).catch(() => {});
	}
}

function parseS3Uri(uri: string) {
	const trimmed = uri.trim();
	const match = trimmed.match(/^s3:\/\/([^/]+)(?:\/(.*))?$/i);
	if (!match) {
		return null;
	}

	const bucket = match[1];
	const prefix = match[2]?.trim();

	return {
		bucket,
		prefix: prefix?.replace(/^\/+/, "").replace(/\/+$/, ""),
	};
}

function combinePrefixes(...parts: Array<string | undefined | null>): string {
	const normalisedParts = parts
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part && part.length > 0))
		.map((part) => part.replace(/^\/+/, "").replace(/\/+$/, ""));

	const combined = normalisedParts.join("/");
	return normaliseKeyPrefix(combined);
}
