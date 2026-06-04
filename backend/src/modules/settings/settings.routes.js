const router = require('express').Router();
const multer = require('multer');
const settingsController = require('./settings.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }));
  },
});

router.get('/', settingsController.getAll);
router.put('/', settingsController.updateAll);
router.post('/logo', upload.single('logo'), settingsController.uploadLogo);

module.exports = router;
