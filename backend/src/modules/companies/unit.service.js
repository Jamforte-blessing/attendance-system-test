const { query, execute } = require('../../shared/database');

async function getUnits({ department_id }) {
  let sql = 'SELECT * FROM units WHERE 1=1';
  const params = [];
  if (department_id) { sql += ` AND department_id = $${params.length + 1}`; params.push(department_id); }
  sql += ' ORDER BY name';
  return query(sql, params);
}

async function createUnit({ name, department_id }) {
  return execute(
    'INSERT INTO units (name, department_id) VALUES ($1, $2) RETURNING id',
    [name.trim(), department_id || null]
  );
}

async function updateUnit(id, { name }) {
  await execute('UPDATE units SET name = $1 WHERE id = $2', [name.trim(), id]);
}

async function deleteUnit(id) {
  await execute('UPDATE employees SET unit_id = NULL WHERE unit_id = $1', [id]);
  await execute('DELETE FROM units WHERE id = $1', [id]);
}

module.exports = { getUnits, createUnit, updateUnit, deleteUnit };
