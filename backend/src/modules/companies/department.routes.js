const router = require('express').Router();
const departmentController = require('./department.controller');

router.get('/', departmentController.list);
router.post('/', departmentController.create);
router.put('/:id', departmentController.update);
router.delete('/:id', departmentController.remove);

module.exports = router;
