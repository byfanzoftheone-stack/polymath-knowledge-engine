// Loader for the vendored shared module (the-one-foundation/packages/license-webhook):
// vendor/index.mjs, vendor/stores.mjs, vendor/async.mjs are verbatim copies and must be updated together.
// They are ES modules, so this CommonJS app loads them with dynamic import() (cached by Node).
let mod;
function load() {
  if (!mod) mod = import('./vendor/async.mjs').then(async (a) => ({ ...(await import('./vendor/index.mjs')), ...a }));
  return mod;
}
module.exports = { load };
