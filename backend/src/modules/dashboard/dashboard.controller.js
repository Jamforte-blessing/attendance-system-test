const dashboardService = require('./dashboard.service');

async function stats(_req, res, next) {
  try {
    res.json(await dashboardService.getStats());
  } catch (err) { next(err); }
}

async function notifications(_req, res, next) {
  try {
    res.json(await dashboardService.getNotifications());
  } catch (err) { next(err); }
}

async function live(_req, res, next) {
  try {
    res.json(await dashboardService.getLive());
  } catch (err) { next(err); }
}

module.exports = { stats, notifications, live };
