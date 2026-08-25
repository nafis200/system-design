import type { Server } from 'http';

import app from './app';
import config from './app/config';
import { connectDatabase, disconnectDatabase } from './app/config/db';
import { logger } from './app/utils/logger';

/**
 * Process lifecycle.
 *
 * The previous version's `unhandledRejection` and `uncaughtException` handlers
 * took no arguments, so a crash was logged as a bare string with the error
 * discarded — leaving nothing to debug. There was also no SIGTERM handling, so
 * every deploy killed in-flight requests mid-response.
 */

let server: Server | undefined;
let shuttingDown = false;

/** Requests already in flight get this long to finish before the process exits. */
const SHUTDOWN_GRACE_MS = 15_000;

async function bootstrap(): Promise<void> {
  await connectDatabase();

  server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.NODE_ENV, pid: process.pid },
      'server listening',
    );
  });

  /**
   * A port clash is the most common local start-up failure, and the default
   * error is a bare stack trace. On macOS it is worse than unhelpful: AirPlay
   * Receiver holds 5000 and 7000 and answers with a 403 from "AirTunes", so the
   * app looks broken rather than absent.
   */
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal(
        { port: config.port },
        `Port ${config.port} is already in use. Stop whatever is holding it, or set PORT in .env.` +
          (config.port === 5000 || config.port === 7000
            ? ' On macOS these ports belong to AirPlay Receiver — disable it under System Settings › General › AirDrop & Handoff, or pick another port.'
            : ''),
      );
      process.exit(1);
    }

    logger.fatal({ err: error }, 'server error');
    process.exit(1);
  });

  // Long-lived keep-alive sockets otherwise outlive the shutdown window.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

/**
 * Stops accepting connections, drains what is in flight, closes the database,
 * then exits. A hard timer guarantees the process leaves even if a socket hangs,
 * so an orchestrator never has to SIGKILL it.
 */
async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ reason }, 'shutting down');

  const forceExit = setTimeout(() => {
    logger.error({ reason }, 'graceful shutdown timed out — forcing exit');
    process.exit(exitCode || 1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
      logger.info('stopped accepting connections');
    }

    await disconnectDatabase();
    clearTimeout(forceExit);
    logger.info({ reason }, 'shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error, reason }, 'error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  // The process is in an undefined state here; drain and exit rather than
  // continue serving from it.
  logger.fatal({ err: error }, 'uncaught exception');
  void shutdown('uncaughtException', 1);
});

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'failed to start server');
  process.exit(1);
});
