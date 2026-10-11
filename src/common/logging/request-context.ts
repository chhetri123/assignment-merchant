import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  actorId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setActorId(actorId: string): void {
  const context = storage.getStore();
  if (context) {
    context.actorId = actorId;
  }
}
