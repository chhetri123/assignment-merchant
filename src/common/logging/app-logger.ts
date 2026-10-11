import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { currentRequestContext } from './request-context';

// Adds the request id to every line, and emits JSON outside development so
// logs stay queryable once shipped.
export class AppLogger extends ConsoleLogger {
  private readonly asJson = process.env.NODE_ENV === 'production';

  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    const context = currentRequestContext();

    if (!this.asJson) {
      const suffix = context ? ` [req ${context.requestId}]` : '';
      return super.formatMessage(
        logLevel,
        typeof message === 'string' ? `${message}${suffix}` : message,
        pidMessage,
        formattedLogLevel,
        contextMessage,
        timestampDiff,
      );
    }

    return `${JSON.stringify({
      level: logLevel,
      time: new Date().toISOString(),
      context: contextMessage.trim() || undefined,
      requestId: context?.requestId,
      actorId: context?.actorId,
      message,
    })}\n`;
  }
}
