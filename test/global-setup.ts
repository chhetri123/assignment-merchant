import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source';

const TEST_DATABASE = process.env.TEST_DB_DATABASE ?? 'merchant_test';

// Creates the test database once per run and brings it up to the latest
// migration, so e2e never touches development data.
export default async function globalSetup(): Promise<void> {
  const admin = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    TEST_DATABASE,
  ]);
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${TEST_DATABASE}"`);
  }
  await admin.end();

  const dataSource = new DataSource({ ...dataSourceOptions, database: TEST_DATABASE });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
