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

// Logs internals, returns a safe shape.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toErrorBody(exception, request.url);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${body.statusCode}: ${body.message}`);
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as Record<string, unknown>).message as string | string[]);

      return {
        statusCode: status,
        message: message ?? exception.message,
        error: HttpStatus[status] ?? 'ERROR',
        path,
        timestamp,
      };
    }

    if (exception instanceof QueryFailedError) {
      const driverCode = (exception as QueryFailedError & { code?: string }).code;
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
