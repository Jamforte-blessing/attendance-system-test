const router = require('express').Router();
const employeeController = require('./employee.controller');

router.get('/', employeeController.list);
router.get('/next-id', employeeController.nextId);
router.get('/:id/stats', employeeController.stats);
router.get('/:id', employeeController.getOne);
router.post('/', employeeController.create);
router.post('/:id/generate-password', employeeController.generatePassword);
router.put('/:id', employeeController.update);
router.delete('/:id/permanent', employeeController.permanentDelete);
router.delete('/:id', employeeController.deactivate);

module.exports = router;
