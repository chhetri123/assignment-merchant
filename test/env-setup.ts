// Runs in every worker before the app is imported, so the API never points at
// the development database.
process.env.NODE_ENV = 'test';
process.env.DB_DATABASE = process.env.TEST_DB_DATABASE ?? 'merchant_test';
// Separate Redis db, so a locally running API never steals the test's jobs.
process.env.REDIS_DB = process.env.TEST_REDIS_DB ?? '1';
// Short backoff so retry behaviour can be exercised without slow tests.
process.env.RISK_JOB_BACKOFF_MS = '50';
