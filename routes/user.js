const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../config/verifyToken');

const path = require('path')
const fs = require('fs')
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink)


router.post("/pet/add", authenticateToken, async (req, res) => {

    const { name, specie, breed, gender, dateOfBirth, vaccinated, friendly, microchip } = req.body;

    //Validations
    if (!name) return res.status(422).json({ message: 'Name is required!' })
    if (!specie) return res.status(422).json({ message: 'Specie is required!' })
    if (!gender) return res.status(422).json({ message: 'Gender is required!' })
    if (!dateOfBirth) return res.status(422).json({ message: 'Date of birth is required!' })

     //Create a new pet
     const pet = new Pet({
        user_id: req.userId,
        name: name,
        specie: specie,
        breed: breed || "",
        gender: gender,
        dateOfBirth: dateOfBirth,
        photo: "",
        vaccinated: vaccinated || false,
        friendly: friendly || false,
        microchip: microchip || false
    });

    try {
        const savedPet = await pet.save();
        return res.status(200).json(savedPet);
      } catch (err) {
        return res.status(400).json({ message: err });
      }

})


router.post("/profile/upload", authenticateToken, async (req, res) => {

    const { file, filename } = req.body;

    //Validations
    if (!file) return res.status(422).json({ message: 'file is required!' })
    if (!filename) return res.status(422).json({ message: 'filename is required!' })

    if (req.userId != undefined) {

        const user = await User.findById(req.userId);
        if (!user) return res.status(400).json({ message: "This user does not exist." })

        if (user.image != "") {

            //delete the older image
            var oldpath = "images\\"+user.image
            await unlinkAsync(oldpath);

        }

        try {

            const buffer = Buffer.from(file.split(',')[1], 'base64');

            var path = "./images/" + filename
    
            fs.writeFile(path, buffer, (err) => {
                if (err) return res.sendStatus(403)
            })

            const filePath = "http://192.168.68.118:3000/images/"+filename

            await User.updateOne(
                { _id: req.userId },
                { $set: { image: filePath } }

            )

            res.status(200).json({ url: filePath })

        } catch(err) {
            res.status(500).json({ message: err.message || "Error Occured while retriving information." })
        }

    }
    else {
        
        try {

            const buffer = Buffer.from(file.split(',')[1], 'base64');

            var path = "./images/" + filename
    
            fs.writeFile(path, buffer, (err) => {
                if (err) return res.sendStatus(403)
            })

            const filePath = "http://192.168.68.118:3000/images/"+filename

            res.status(200).json({ url: filePath })

        } catch(err) {
            res.status(500).json({ message: err.message || "Error Occured while retriving information." })
        }

    }

})





module.exports = router;
