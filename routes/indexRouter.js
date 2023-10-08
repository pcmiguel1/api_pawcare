var router = require('express').Router();

router.get('/template/edit', function(req, res, next) {
    res.render('edit');
});

router.get('/sign', function(req, res, next) {
    res.render('sign');
})

module.exports = router;