const reportService = require('./report.service');

async function summary(req, res, next) {
  try {
    res.json(await reportService.getSummary(req.query));
  } catch (err) { next(err); }
}

async function daily(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    res.json(await reportService.getDaily(date));
  } catch (err) { next(err); }
}

async function exportCsv(req, res, next) {
  try {
    const { range, logs } = await reportService.getExportData(req.query);

    const headers = ['Employee ID', 'Name', 'Department', 'Type', 'Timestamp', 'Late', 'Source', 'Notes'];
    const csvRows = [
      headers.join(','),
      ...logs.map(row =>
        headers.map(h => {
          const val = row[h] == null ? '' : String(row[h]);
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${range.from}_to_${range.to}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (err) { next(err); }
}

async function audit(_req, res, next) {
  try {
    res.json(await reportService.getAuditLogs());
  } catch (err) { next(err); }
}

module.exports = { summary, daily, exportCsv, audit };
