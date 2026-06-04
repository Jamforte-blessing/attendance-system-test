const dashboardService = require('./dashboard.service');

async function stats(req, res, next) {
  try {
    res.json(await dashboardService.getStats(req.user));
  } catch (err) { next(err); }
}

async function notifications(req, res, next) {
  try {
    res.json(await dashboardService.getNotifications(req.user));
  } catch (err) { next(err); }
}

async function live(req, res, next) {
  try {
    res.json(await dashboardService.getLive(req.user));
  } catch (err) { next(err); }
}

module.exports = { stats, notifications, live };
