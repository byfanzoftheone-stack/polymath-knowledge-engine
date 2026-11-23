#!/usr/bin/env node
// Owner CLI: human-approved key delivery. Never sends email, never calls Stripe.
//   node scripts/license-outbox.js list
//   node scripts/license-outbox.js delivered <hash> --approver "<name>"
//   node scripts/license-outbox.js migrate-json <file>     (import a legacy licenses.json into the configured store)
// Uses the store chosen by LICENSE_DATABASE_URL (Postgres) or LICENSE_DB (SQLite/JSON path).
// Plaintext keys are printed by `list`: protect the terminal output.
require('dotenv').config();
const { getLicenses, closeLicenses } = require('../backend/src/billing/licenses');

const USAGE = 'Usage: license-outbox.js list | delivered <hash> --approver "<name>" | migrate-json <file>';

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!(cmd === 'list' || (cmd === 'delivered' && rest[0]) || (cmd === 'migrate-json' && rest[0]))) {
    console.error(USAGE);
    return 1;
  }
  let svc;
  try { svc = await getLicenses(); }
  catch (e) { console.error(`License store not available: ${e.message}`); return 1; }
  const { lw } = svc;

  if (cmd === 'list') {
    const rows = await lw.pendingDeliveries();
    if (!rows.length) console.log('No pending deliveries.');
    for (const r of rows) console.log(`${r.hash}\t${r.tier}\t${r.email || '-'}\t${r.key}`);
  } else if (cmd === 'delivered') {
    const i = rest.indexOf('--approver');
    const approver = i >= 0 ? rest[i + 1] : '';
    if (!approver) { console.error('--approver "<name>" is required'); return 1; }
    await lw.markDelivered(rest[0], approver);
    console.log(`Marked delivered (approver: ${approver}); plaintext dropped.`);
  } else {
    const c = await svc.migrate(rest[0]);
    console.log(`Imported ${c.licenses} licenses, ${c.outbox} outbox entries, ${c.events} events (idempotent; safe to re-run).`);
  }
  return 0;
}

main()
  .catch((e) => { console.error(e.message); return 1; })
  .then(async (code) => { await closeLicenses(); process.exit(code); });
