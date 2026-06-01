const router = require('express').Router();
const companyController = require('./company.controller');

router.get('/', companyController.list);
router.get('/:id', companyController.getOne);
router.post('/', companyController.create);
router.put('/:id', companyController.update);
router.patch('/:id/location', companyController.updateLocation);
router.delete('/:id', companyController.remove);
router.get('/:id/departments', companyController.getDepartments);
router.post('/:id/departments', companyController.createDepartment);
router.delete('/:companyId/departments/:deptId', companyController.deleteDepartment);

module.exports = router;
