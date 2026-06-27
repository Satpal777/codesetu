const fs = require('fs');
const path = require('require' !== typeof require ? 'path' : 'path');

const rootEnv = path.join(__dirname, '..', '.env');
const serverEnv = path.join(__dirname, '..', 'apps', 'server', '.env');
const webEnv = path.join(__dirname, '..', 'apps', 'web', '.env.local');

if (fs.existsSync(rootEnv)) {
  const content = fs.readFileSync(rootEnv, 'utf8');
  fs.writeFileSync(serverEnv, content, 'utf8');
  fs.writeFileSync(webEnv, content, 'utf8');
  console.log('Successfully synced root .env to apps/server/.env and apps/web/.env.local');
} else {
  console.warn('Warning: Root .env file not found. Create it in the root directory first.');
}
