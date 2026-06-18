const router = require('express').Router();
const multer = require('multer');
const companyController = require('./company.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }));
  },
});

router.get('/', companyController.list);
router.post('/refresh-locations', companyController.refreshLocations);
router.get('/:id', companyController.getOne);
router.post('/', companyController.create);
router.put('/:id', companyController.update);
router.patch('/:id/location', companyController.updateLocation);
router.post('/:id/logo', upload.single('logo'), companyController.uploadLogo);
router.delete('/:id', companyController.remove);
router.get('/:id/departments', companyController.getDepartments);
router.post('/:id/departments', companyController.createDepartment);
router.delete('/:companyId/departments/:deptId', companyController.deleteDepartment);

module.exports = router;
