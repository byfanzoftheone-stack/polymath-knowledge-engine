const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { query, pool } = require('./index');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function migrate({ reset = false } = {}) {
  if (reset) {
    await query('DROP TABLE IF EXISTS relay_events, relay_jobs, sessions, lessons CASCADE;');
  }

  const schemaPath = path.resolve(__dirname, '../../../docs/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await query(schemaSql);
  console.log('Database schema is ready.');
}

if (require.main === module) {
  const reset = process.argv.includes('--reset');
  migrate({ reset })
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { migrate };
