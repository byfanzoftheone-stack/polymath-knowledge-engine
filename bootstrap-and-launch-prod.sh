#!/usr/bin/env bash
set -euo pipefail

npm run bootstrap
npm run build
npm run start:prod
