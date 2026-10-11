import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { currentRequestContext } from '../logging/request-context';

interface ErrorBody {
  statusCode: number;
  timestamp: string;
  requestId?: string;
  message?: string | string[];
  error?: string;
  // Structured payloads (health checks) carry their own fields.
  [key: string]: unknown;
}

const PG_UNIQUE_VIOLATION = '23505';
const LOWEST_SERVER_ERROR_STATUS = 500;

// Nest puts the validation details on `message`; everything else is a string.
function extractMessage(exception: HttpException): string | string[] {
  const payload: string | object = exception.getResponse();

  if (typeof payload === 'string') {
    return payload;
  }
  if ('message' in payload) {
    const { message } = payload;
    if (typeof message === 'string' || Array.isArray(message)) {
      return message;
    }
  }
  return exception.message;
}

function statusLabel(status: number): string {
  return HttpStatus[status] ?? 'ERROR';
}

function hasDriverCode(error: object): error is { code: string } {
  return 'code' in error && typeof error.code === 'string';
}

// Logs internals, returns a safe shape.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toErrorBody(exception);

    if (body.statusCode >= LOWEST_SERVER_ERROR_STATUS) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      const summary = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      this.logger.warn(`${request.method} ${request.url} -> ${body.statusCode}: ${summary}`);
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    const timestamp = new Date().toISOString();
    const requestId = currentRequestContext()?.requestId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload: string | object = exception.getResponse();

      // Structured payloads (health checks, for example) describe themselves;
      // flattening them would throw away which dependency failed.
      if (typeof payload === 'object' && !('message' in payload)) {
        return { ...payload, statusCode: status, timestamp, requestId };
      }

      return {
        statusCode: status,
        message: extractMessage(exception),
        error: statusLabel(status),
        timestamp,
        requestId,
      };
    }

    if (exception instanceof QueryFailedError) {
      const driverCode = hasDriverCode(exception) ? exception.code : undefined;
      if (driverCode === PG_UNIQUE_VIOLATION) {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
          error: 'CONFLICT',
          timestamp,
          requestId,
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp,
      requestId,
    };
  }
}
