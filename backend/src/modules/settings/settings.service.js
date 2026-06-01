const { query, execute } = require('../../shared/database');

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

module.exports = { getAll, updateAll };
