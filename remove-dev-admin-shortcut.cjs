const fs = require('fs');

const file = 'server.ts';
const source = fs.readFileSync(file, 'utf8');

const oldBlock = `    // Local test identities must never grant administrative privileges in production.
    if (allowDevelopmentAuth && (
      userId.startsWith('user_admin_') ||
      userId.startsWith('dev_admin_') ||
      userId.startsWith('mock_admin_') ||
      userId.includes('admin') ||
      userId.includes('mama@') ||
      userId === 'guest-or-dev-user' ||
      userId === 'dev-user'
    )) {
      return true;
    }
`;

if (!source.includes(oldBlock)) {
  console.error('STOP: Expected block not found. No files changed.');
  process.exit(1);
}

const replacement = `    // Authorization must come from the persisted profiles.role value.
    // Never grant admin privileges based on development identities or user ID patterns.
`;

fs.writeFileSync(file, source.replace(oldBlock, replacement));
console.log('Updated checkAdminRole() in server.ts.');
