const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../config/verifyToken');

const path = require('path')

const { Storage } = require("@google-cloud/storage");
const multer = require('multer');

const gc = new Storage({
    keyFilename: path.join(__dirname, "../config/pawcare-390615-bb548a465c8a.json"),
    projectId: "pawcare-390615"
});

// Configure multer storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

const imagesBucket = gc.bucket('pawcare_imgs');


router.post("/pet/add", authenticateToken, upload.single('image'), async (req, res) => {

    const { name, specie, breed, gender, dateOfBirth, vaccinated, friendly, microchip } = req.body;

    //Validations
    if (!name) return res.status(422).json({ message: 'Name is required!' })
    if (!specie) return res.status(422).json({ message: 'Specie is required!' })
    if (!gender) return res.status(422).json({ message: 'Gender is required!' })
    if (!dateOfBirth) return res.status(422).json({ message: 'Date of birth is required!' })

    const file = req.file;

    var publicUrl = ""
    var fileName = ""
    if (file) {

        fileName = Date.now() + "_" + file.originalname;

        const blob = imagesBucket.file(fileName);
        const blobStream = blob.createWriteStream({
            resumable: false,
        })

        blobStream.on("error", (err) => {
            res.status(500).send({ message: err.message });
        });

        blobStream.on("finish", async (data) => {

            publicUrl = `https://storage.googleapis.com/${imagesBucket.name}/${blob.name}`;

            try {
                // Make the file public
                await imagesBucket.file(fileName).makePublic();

            } catch (err) {
                console.log(err);
                res.status(400).json({ message: err });
            }
        });
      
        blobStream.end(req.file.buffer);

    }

     //Create a new pet
     const pet = new Pet({
        user_id: req.userId,
        name: name,
        specie: specie,
        breed: breed || "",
        gender: gender,
        dateOfBirth: dateOfBirth,
        photo: publicUrl,
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

router.post("/pet/update/:id", authenticateToken, async (req, res) => {

    let id = req.params.id;

    const petExist = await Pet.findOne({_id: id, user_id: req.userId});
    if (!petExist) return res.status(422).json({ message: "No result!" })

    await Pet.findByIdAndUpdate(
        id, { $set: req.body }
    ).then(() => {
        return res.status(200).json({ message: "Pet updated successfully!" });
    });

})

router.get('/pet/delete/:id', authenticateToken, async (req, res) => {
    let id = req.params.id;

    const petExist = await Pet.findOne({_id: id, user_id: req.userId});
    if (!petExist) return res.status(422).json({ message: "No result!" })

    Pet.findByIdAndDelete(id, (err, result) => {
        if (err) {
            res.json({ message: err.message });
        } else {
            return res.status(200).json({ message: "Pet deleted successfully!" });
        }
    });
});

router.get("/pets", authenticateToken, async (req, res) => {

    const pets = await Pet.find({ user_id: req.userId });
    //if (pets.length === 0) return res.status(200).json({ message: 'There are no pets!' });

    res.status(200).json(pets)

})

router.post("/update", authenticateToken, upload.single('image'), async (req, res) => {

    var body = JSON.parse(req.body.user)

    //var body = req.body

    var update = {}
    update = body;

    const file = req.file;

    var fileName = ""
    if (file) {

        fileName = Date.now() + "_" + file.originalname;

        const blob = imagesBucket.file(fileName);
        const blobStream = blob.createWriteStream({
            resumable: false,
        })

        blobStream.on("error", (err) => {
            res.status(500).send({ message: err.message });
        });

        blobStream.on("finish", async (data) => {

            const publicUrl = `https://storage.googleapis.com/${imagesBucket.name}/${blob.name}`;

            // Make the file public
            await imagesBucket.file(fileName).makePublic();

            update.image = publicUrl;

            if ('password' in body) {

                const salt = await bcrypt.genSalt(10);
                const hashPassword = await bcrypt.hash(body.password, salt);
        
                update.password = hashPassword;
        
            }
    
            try {
                const updatedUser = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true });
                return res.status(200).json(updatedUser);
            } catch (err) {
                console.log(err);
                return res.status(400).json({ message: err });
            }

        });
      
        blobStream.end(req.file.buffer);


    }
    else {

        if ('password' in body) {

            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(body.password, salt);
    
            update.password = hashPassword;
    
        }
    
        await User.findByIdAndUpdate(
            req.userId, { $set: update }
        ).then((result) => {
            return res.status(200).json(result);
        });

    }

})



module.exports = router;
