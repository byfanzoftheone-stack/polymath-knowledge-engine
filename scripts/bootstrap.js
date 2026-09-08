#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const envExample = path.join(root, '.env.example');
const envFile = path.join(root, '.env');
const seedFile = path.join(root, 'docs', 'starter-content', 'lessons.json');

function ensureEnv() {
  if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    console.log('Created .env from .env.example');
  }
}

function ensureDirs() {
  [
    path.join(root, 'backend', 'logs'),
    path.join(root, 'docs', 'starter-content')
  ].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

function ensureSeedFile() {
  if (!fs.existsSync(seedFile)) {
    fs.writeFileSync(seedFile, JSON.stringify([
      {
        id: 'intro-variables',
        slug: 'intro-variables',
        title: 'Introduction to Variables',
        description: 'Learn variable basics through a short command relay exercise.'
      },
      {
        id: 'git-basics',
        slug: 'git-basics',
        title: 'Git Basics',
        description: 'Practice safe git inspection commands and review outputs.'
      }
    ], null, 2));
    console.log('Generated starter lessons file.');
  }
}

function installDependencies() {
  execSync('npm install', { cwd: root, stdio: 'inherit' });
  execSync('npm --prefix frontend install', { cwd: root, stdio: 'inherit' });
}

function tryMigrateAndSeed() {
  try {
    execSync('node backend/src/db/migrate.js', { cwd: root, stdio: 'inherit' });
    execSync('node backend/src/db/seed.js', { cwd: root, stdio: 'inherit' });
  } catch (error) {
    console.warn('Bootstrap warning: database migration/seed skipped. Ensure PostgreSQL is running and DATABASE_URL is valid.');
  }
}

function main() {
  ensureDirs();
  ensureEnv();
  ensureSeedFile();
  installDependencies();
  tryMigrateAndSeed();
  console.log('Bootstrap complete.');
}

main();
