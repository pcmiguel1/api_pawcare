const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const Sitter = require('../models/Sitter');
const PictureImage = require('../models/PictureSitter');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../config/verifyToken');
const path = require('path')

const { Storage } = require("@google-cloud/storage");
const multer = require('multer');
const { json } = require('body-parser');

const gc = new Storage({
    keyFilename: path.join(__dirname, "../config/pawcare-390615-bb548a465c8a.json"),
    projectId: "pawcare-390615"
});

// Configure multer storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

const imagesBucket = gc.bucket('pawcare_imgs');

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

router.get("/pictures", authenticateToken, async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const pictures = await PictureImage.find({user_id: req.userId});
    return res.status(200).json(pictures);

})

router.post("/picture/delete/:filename", authenticateToken, async (req, res) => {

    let filename = req.params.filename;

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const pictureExist = await PictureImage.findOne({user_id: req.userId, filename: filename});
    if (!pictureExist) return res.status(400).json({ message: "Filename don't exists!" })

    try {

        //delete image from google cloud storage
        await imagesBucket.file(filename).delete();

        //delete image from database
        PictureImage.findByIdAndDelete(pictureExist._id, (err, result) => {
            if (err) {
                res.json({ message: err.message });
            } else {
                return res.status(200).json({ message: "Picture deleted successfully!" });
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Failed to delete image."});
    }


})

router.post("/picture/add", authenticateToken, upload.single('image'), async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

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

            //Create a new user
            const picture = new PictureImage({
                user_id: req.userId,
                filename: blob.name,
                url: publicUrl
            });

            try {
                const savedUser = await picture.save()
                .then((result) => {
                    //sendVerificationEmail(result, res);
                    return res.status(200).json(result);
                })
                .catch((err) => {
                    res.status(400).json({ message: err });
                })

            } catch(err) {
                res.status(400).json({ message: err });
            }

        });
      
        blobStream.end(req.file.buffer);

    }


})

router.get("/:id", authenticateToken, async (req, res) => {

    let id = req.params.id;

    const sitterExist = await Sitter.findOne({user_id: id});
    if (!sitterExist) return res.status(422).json({ message: "No result!" })

    return res.status(200).json({sitterExist});

})

module.exports = router;
