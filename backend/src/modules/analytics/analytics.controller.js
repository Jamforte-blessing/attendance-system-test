const analyticsService = require('./analytics.service');

async function analytics(req, res, next) {
  try {
    const { employee_id, department_id, date_from, date_to } = req.query;
    res.json(await analyticsService.getAnalytics({ employee_id, department_id, date_from, date_to }, req.user));
  } catch (err) { next(err); }
}

module.exports = { analytics };
