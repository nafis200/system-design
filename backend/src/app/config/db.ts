import mongoose from "mongoose";

import config from ".";
import { isProduction } from "./env";
import { logger } from "../utils/logger";

/**
 * Database connection.
 *
 * Sized and timed explicitly rather than relying on driver defaults. At 1000+
 * concurrent users the pool is the first thing to saturate, and an unbounded
 * `serverSelectionTimeoutMS` turns a brief primary election into a pile-up of
 * hung requests.
 */

let isShuttingDown = false;

export async function connectDatabase(): Promise<void> {
  // Fail fast on unknown fields instead of silently dropping them.
  mongoose.set("strictQuery", true);

  // Index builds are a foreground operation on large collections; in production
  // they belong in a migration, not in the boot path of every instance.
  mongoose.set("autoIndex", !isProduction);

  mongoose.connection.on("connected", () => {
    logger.info(
      { host: mongoose.connection.host, db: mongoose.connection.name },
      "database connected",
    );
  });

  mongoose.connection.on("error", (error) => {
    logger.error({ err: error }, "database connection error");
  });

  mongoose.connection.on("disconnected", () => {
    // Expected during shutdown; noteworthy at any other time.
    if (isShuttingDown) return;
    logger.warn("database disconnected — driver will retry");
  });

  await mongoose.connect(config.database_url, {
    // Pool sizing. Keep max below the connection ceiling of your Atlas tier,
    // remembering the limit is shared across every running instance.
    maxPoolSize: config.db.max_pool_size,
    minPoolSize: config.db.min_pool_size,

    // Recycle idle connections so a scaled-down deployment releases them.
    maxIdleTimeMS: 60_000,

    // Give up on selecting a server quickly so requests fail rather than hang.
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    heartbeatFrequencyMS: 10_000,

    // Majority writes and retryable reads/writes: the safe default for a
    // replica set, and what Atlas expects.
    retryWrites: true,
    retryReads: true,
    writeConcern: { w: "majority" },

    // Compression cuts egress noticeably on list endpoints.
    compressors: ["zlib"],
  });

  if (!isProduction) {
    // Index creation is async; surface failures instead of swallowing them.
    void mongoose.connection.asPromise().catch((error) => {
      logger.error({ err: error }, "database index synchronisation failed");
    });
  }
}

export async function disconnectDatabase(): Promise<void> {
  isShuttingDown = true;
  await mongoose.connection.close(false);
  logger.info("database connection closed");
}

/** 1 = connected. Used by the readiness probe. */
export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export function databaseState(): string {
  const states: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
    99: "uninitialized",
  };
  return states[mongoose.connection.readyState] ?? "unknown";
}
