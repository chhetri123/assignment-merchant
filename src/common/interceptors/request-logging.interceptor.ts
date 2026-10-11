import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { type Request } from 'express';
import { Observable, tap } from 'rxjs';
import { redact } from '../security/redact';
import { setActorId } from '../logging/request-context';

// Bodies are redacted before logging.
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const startedAt = Date.now();
    const { method, url } = request;
    const actorId = request.user?.id;
    if (actorId) {
      setActorId(actorId);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${url} actor=${actorId ?? 'anonymous'} ${Date.now() - startedAt}ms ` +
              `body=${JSON.stringify(redact(request.body))}`,
          );
        },
      }),
    );
  }
}
