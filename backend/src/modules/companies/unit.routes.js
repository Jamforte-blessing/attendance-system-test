const router = require('express').Router();
const unitController = require('./unit.controller');

router.get('/', unitController.list);
router.post('/', unitController.create);
router.put('/:id', unitController.update);
router.delete('/:id', unitController.remove);

module.exports = router;
