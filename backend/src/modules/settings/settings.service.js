const { query, execute } = require('../../shared/database');
const { uploadBuffer } = require('../../shared/utils/cloudinary');

async function getAll() {
  const rows = await query('SELECT "key", value FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

async function updateAll(body) {
  for (const [key, value] of Object.entries(body)) {
    await execute(
      'INSERT INTO settings ("key", value) VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value',
      [key, String(value)]
    );
  }
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['UPDATE', 'settings', null, JSON.stringify(body)]
  );
}

async function uploadLogo(buffer) {
  const result = await uploadBuffer(buffer, {
    folder: 'saas-logos',
    resource_type: 'image',
    public_id: 'system-logo',
    overwrite: true,
    invalidate: true,
  });
  const logoUrl = result.secure_url;
  await execute(
    'INSERT INTO settings ("key", value) VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value',
    ['logo_url', logoUrl]
  );
  return logoUrl;
}

module.exports = { getAll, updateAll, uploadLogo };
