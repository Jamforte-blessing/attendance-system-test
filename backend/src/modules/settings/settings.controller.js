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

async function uploadLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const logoUrl = await settingsService.uploadLogo(req.file.buffer);
    res.json({ logo_url: logoUrl });
  } catch (err) { next(err); }
}

module.exports = { getAll, updateAll, uploadLogo };
