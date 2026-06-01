const analyticsService = require('./analytics.service');

async function analytics(_req, res, next) {
  try {
    res.json(await analyticsService.getAnalytics());
  } catch (err) { next(err); }
}

module.exports = { analytics };
