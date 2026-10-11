import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithRequestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

// An inbound id is reused so a trace can be followed across services; the
// response always carries it back.
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const inbound = request.header(REQUEST_ID_HEADER);
    const requestId = inbound && inbound.length <= 64 ? inbound : randomUUID();

    response.setHeader(REQUEST_ID_HEADER, requestId);
    runWithRequestContext({ requestId }, () => {
      next();
    });
  }
}
