#!/usr/bin/env node
// Owner CLI: human-approved key delivery. Never sends email, never calls Stripe.
//   node scripts/license-outbox.js list
//   node scripts/license-outbox.js delivered <hash> --approver "<name>"
// Plaintext keys are printed by `list`: protect the terminal output.
require('dotenv').config();
const { getLicenses } = require('../backend/src/billing/licenses');

const [cmd, ...rest] = process.argv.slice(2);
const lw = getLicenses();

if (cmd === 'list') {
  const rows = lw.pendingDeliveries();
  if (!rows.length) console.log('No pending deliveries.');
  for (const r of rows) console.log(`${r.hash}\t${r.tier}\t${r.email || '-'}\t${r.key}`);
} else if (cmd === 'delivered' && rest[0]) {
  const i = rest.indexOf('--approver');
  const approver = i >= 0 ? rest[i + 1] : '';
  if (!approver) { console.error('--approver "<name>" is required'); process.exit(1); }
  try { lw.markDelivered(rest[0], approver); console.log(`Marked delivered (approver: ${approver}); plaintext dropped.`); }
  catch (e) { console.error(e.message); process.exit(1); }
} else {
  console.error('Usage: license-outbox.js list | delivered <hash> --approver "<name>"');
  process.exit(1);
}
