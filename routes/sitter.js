const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const Sitter = require('../models/Sitter');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../config/verifyToken');

router.get("/:id", authenticateToken, async (req, res) => {

    let id = req.params.id;

    const sitterExist = await Sitter.findOne({user_id: id});
    if (!sitterExist) return res.status(422).json({ message: "No result!" })

    return res.status(200).json({sitterExist});

})

router.post("/application/start", authenticateToken, async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (sitterExist) return res.status(400).json({ message: "User already start the application." })

    const sitter = new Sitter({
        user_id: req.userId
    });

    try {
        const savedSitter = await sitter.save()
        .then((result) => {
            return res.status(200).json(result);
        })
        .catch((err) => {
            res.status(400).json({ message: err });
        })

    } catch(err) {
        res.status(400).json({ message: err });
    }

})

router.post("/application/send", authenticateToken, async (req, res) => {



})

module.exports = router;
