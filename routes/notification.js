const router = require('express').Router();
const Notification = require('../models/Notification');
const Notifications = require('../models/Notifications');
const admin = require('firebase-admin');
const { authenticateToken } = require('../config/verifyToken');


router.post("/postToken", authenticateToken, async (req, res) => {

    const { token } = req.body;

    //Validations
    if (!token) return res.status(422).json({ msg: 'Token is required!' })

    const userExist = await Notification.findOne({user_id: req.userId});
    if (!userExist) {

        const notification = new Notification({
            token: token,
            userId: req.userId
        });
    
        try {
            const savedNotification = await notification.save();
        
            res.status(200).json({ message: "notification code sent" })
        } catch(err) {
            res.status(400).send(err);
        }

    } else {

        try {

            await Notification.findByIdAndUpdate(userExist._id, { token: token }, { new: true });

            return res.status(200).json({ message: "notification code sent" })
        } catch (err) {
            console.log(err);
            return res.status(400).json({ message: err });
        }

    }

})

router.post("/send", authenticateToken, async (req, res) => {

    const { userId, title, body } = req.body;

    if (!userId) return res.status(422).json({ msg: 'userId is required!' })
    if (!title) return res.status(422).json({ msg: 'title is required!' })
    if (!body) return res.status(422).json({ msg: 'body is required!' })

    const userExist = await Notification.findOne({user_id: id});
    if (!userExist) return res.status(422).json({ message: "No result!" })

    const message = {
        notification: {
            title: title,
            body: body
        },
        token: userExist.token
    };

    admin.messaging().send(message)
        .then(async (response) => {

            const notifications = new Notifications({
                userId: req.userId,
                title: title,
                body: body
            });
        
            try {
                const savedNotification = await notifications.save();
            
                console.log('Successfully sent message:', response);
                res.status(200).json(savedNotification)
            } catch(err) {
                res.status(400).send(err);
            }

        })
        .catch((error) => {
            console.log('Error sending message:', error);
            res.status(400).send(error);
    });

})

module.exports = router;