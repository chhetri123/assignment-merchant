// Runs in every worker before the app is imported, so the API never points at
// the development database.
process.env.NODE_ENV = 'test';
process.env.DB_DATABASE = process.env.TEST_DB_DATABASE ?? 'merchant_test';
