import { AppLogger } from './app-logger';
import { runWithRequestContext } from './request-context';

// formatMessage is protected; this subclass exposes it for assertions.
class TestableLogger extends AppLogger {
  format(message: string, context = 'Test'): string {
    return this.formatMessage('log', message, '', 'LOG', ` [${context}] `, '');
  }
}

describe('AppLogger', () => {
  const previousEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it('emits JSON with the request id in production', () => {
    process.env.NODE_ENV = 'production';
    const logger = new TestableLogger();

    const line = runWithRequestContext({ requestId: 'req-1', actorId: 'user-1' }, () =>
      logger.format('application submitted'),
    );

    expect(JSON.parse(line)).toMatchObject({
      level: 'log',
      requestId: 'req-1',
      actorId: 'user-1',
      message: 'application submitted',
    });
  });

  it('appends the request id in development', () => {
    process.env.NODE_ENV = 'development';
    const logger = new TestableLogger();

    const line = runWithRequestContext({ requestId: 'req-2' }, () => logger.format('hello'));

    expect(line).toContain('hello [req req-2]');
  });

  it('works outside a request, such as on boot', () => {
    process.env.NODE_ENV = 'development';
    expect(new TestableLogger().format('starting')).toContain('starting');
  });
});
