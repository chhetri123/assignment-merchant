import 'dotenv/config';
import { DataSource } from 'typeorm';
import { type PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

// Used by both the TypeORM CLI and TypeOrmModule.
export const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: false,
  logging: process.env.DB_LOGGING === 'true',
};

export default new DataSource(dataSourceOptions);
