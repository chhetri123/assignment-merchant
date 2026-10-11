import dataSource from './data-source';

// Compiled entrypoint so the production image can migrate without ts-node.
async function run(): Promise<void> {
  await dataSource.initialize();
  const applied = await dataSource.runMigrations();
  console.log(
    applied.length === 0
      ? 'No migrations are pending'
      : `Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(', ')}`,
  );
  await dataSource.destroy();
}

run().catch((error: unknown) => {
  console.error('migration failed', error);
  process.exit(1);
});
