#!/usr/bin/env bash
set -e

echo "=== Checking dist/ bundle for leaked secrets ==="

if [ ! -d "dist/assets" ]; then
  echo "dist/assets does not exist. Run 'npm run build' first."
  exit 1
fi

node -e "
const fs = require('fs');
const path = require('path');
const distAssets = fs.readdirSync('dist/assets');
const jsFiles = distAssets.filter(f => f.endsWith('.js'));
console.log('Inspecting JS bundle files:', jsFiles);

const forbiddenTerms = [
  'JWT_SECRET',
  'NEON_DATABASE_URL',
  'DATABASE_URL',
  'CLOUDINARY_API_SECRET',
  'password_hash'
];

let leaks = 0;
for (const file of jsFiles) {
  const content = fs.readFileSync(path.join('dist/assets', file), 'utf8');
  for (const term of forbiddenTerms) {
    if (content.includes(term)) {
      console.error('❌ LEAK DETECTED:', term, 'found in', file);
      leaks++;
    }
  }
}

if (leaks === 0) {
  console.log('✅ ZERO secrets, connection strings, or password hashes in frontend bundle!');
} else {
  console.error('❌ Total leaks detected:', leaks);
  process.exit(1);
}
"
