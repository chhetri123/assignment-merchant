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

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
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

    const body = this.toErrorBody(exception, request.url);

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

  private toErrorBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        statusCode: status,
        message: extractMessage(exception),
        error: statusLabel(status),
        path,
        timestamp,
      };
    }

    if (exception instanceof QueryFailedError) {
      const driverCode = hasDriverCode(exception) ? exception.code : undefined;
      if (driverCode === PG_UNIQUE_VIOLATION) {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
          error: 'CONFLICT',
          path,
          timestamp,
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'INTERNAL_SERVER_ERROR',
      path,
      timestamp,
    };
  }
}
