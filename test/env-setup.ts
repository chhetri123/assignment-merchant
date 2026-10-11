// Runs in every worker before the app is imported.
process.env.NODE_ENV = 'test';
// Set unconditionally: .env defines the development database, and the tests
// must never run against it.
process.env.DB_DATABASE = process.env.TEST_DB_DATABASE ?? 'merchant_test';
// Separate Redis db, so a locally running API never steals the test's jobs.
process.env.REDIS_DB = process.env.TEST_REDIS_DB ?? '1';
// Tunable per run; short backoff keeps the retry tests fast.
process.env.RISK_JOB_BACKOFF_MS ??= '50';
process.env.THROTTLE_AUTH_LIMIT ??= '15';
process.env.THROTTLE_LIMIT ??= '200';
