const router = require('express').Router();
const Notification = require('../../models/Notification');
const { authenticateToken, adminAuthenticateToken } = require('../../config/verifyToken');


router.post("/postToken", authenticateToken, async (req, res) => {

    const { token } = req.body;

    //Validations
    if (!token) return res.status(422).json({ msg: 'Token is required!' })

    const notification = new Notification({
        token: token
    });

    try {
        const savedNotification = await notification.save();
    
        res.status(200).json(savedNotification);
    } catch(err) {
        res.status(400).send(err);
    }

})

module.exports = router;