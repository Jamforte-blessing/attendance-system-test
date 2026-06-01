const settingsService = require('./settings.service');

async function getAll(_req, res, next) {
  try {
    res.json(await settingsService.getAll());
  } catch (err) { next(err); }
}

async function updateAll(req, res, next) {
  try {
    await settingsService.updateAll(req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { getAll, updateAll };
