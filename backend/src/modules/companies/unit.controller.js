const unitService = require('./unit.service');

async function list(req, res, next) {
  try {
    res.json(await unitService.getUnits(req.query));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, department_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await unitService.createUnit(req.body);
    res.status(201).json({ id: result.id, name, department_id: department_id || null });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    await unitService.updateUnit(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await unitService.deleteUnit(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, remove };
