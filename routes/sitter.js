const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const Sitter = require('../models/Sitter');
const PictureImage = require('../models/PictureSitter');
const PhoneVerification = require('../models/PhoneVerification');
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

router.post("/phone/verify", authenticateToken, async (req, res) => {

    const { phoneNumber, code } = req.body;

    if (!phoneNumber) return res.status(422).json({ message: 'PhoneNumber is required!' })
    if (!code) return res.status(422).json({ message: 'Code is required!' })

    PhoneVerification
    .find({userId: req.userId})
    .then((result) => {
        if (result.length > 0) {

            // phone verification record exists so we proceed

            const {expiresAt} = result[0];
            const codeString = result[0].code; 

            //checking for expired unique string
            if (expiresAt < Date.now()) {

                //record has expired so we delete it
                PhoneVerification
                .deleteOne({userId: req.userId})
                .then((result) => {

                    res.status(400).json({ message: "Verification Code not valid!" });

                })
                .catch((err) => {
                    res.status(400).json({ message: err })
                })

            }
            else {

                //valid record exists so we validate the user string
                
                if (code == codeString) {

                    Sitter
                    .updateOne({user_id: req.userId}, {phone: phoneNumber})
                    .then(() => {

                        PhoneVerification
                        .deleteOne({userId: req.userId})
                        .then((result) => {

                            res.status(200).json({ message: "Phone Number verified successfully!" });

                        })
                        .catch((err) => {
                            res.status(400).json({ message: err })
                        })

                    })
                    .catch((err) => {
                        res.status(400).json({ message: err })
                    })

                }
                else {
                    // existing record but incorrect verification details passed
                    res.status(400).json({ message: "Verification Code not valid!" })
                }

            }

        }
        else {
            // existing record but incorrect verification details passed
            res.status(400).json({ message: "Verification Code not valid!" })
        }
    })
    .catch((err) => {
        res.status(400).json({ message: err })
    })

})

router.post("/phone/sendVerification/:phoneNumber", authenticateToken, async (req, res) => {

    phoneNumber = req.params.phoneNumber;

    if (!phoneNumber) return res.status(422).json({ message: 'PhoneNumber is required!' })

    const phoneExist = await Sitter.findOne({phone: phoneNumber});
    if (phoneExist) return res.status(422).json({ message: "This phone number is already in use!" })

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const randomNumber = Math.floor(Math.random() * 9000) + 1000;

    const newVerification = new PhoneVerification({
        userId: req.userId,
        code: randomNumber,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    });

    PhoneVerification
    .find({userId: req.userId})
    .then((result) => {

        if (result.length > 0) {

            //phone verification record exists so delete and create a new one

            PhoneVerification
            .deleteOne({userId: req.userId})
            .then((result) => {

                newVerification
                .save()
                .then(() => {

                    //send verification code 


                    console.log(`Verification phone sent ${randomNumber}`)
                    res.status(200).json({ message: "Verification Code Sent!" })

                })
                .catch((err) => {
                    res.status(400).json({ message: err })
                })

            })
            .catch((err) => {
                res.status(400).json({ message: err })
            })

        } else {

            newVerification
            .save()
            .then(() => {
              
                //send verification code 


                console.log(`Verification phone sent ${randomNumber}`)
                res.status(200).json({ message: "Verification Code Sent!" })

            })
            .catch((err) => {
                res.status(400).json({ message: err })
            })

        }

    })
    .catch((err) => {
        res.status(400).json({ message: err })
    })

})

router.get("/", authenticateToken, async (req, res) => {

    let id = req.userId;

    const sitterExist = await Sitter.findOne({user_id: id});
    if (!sitterExist) return res.status(422).json({ message: "No result!" })

    return res.status(200).json(sitterExist);

})

router.post("/update", authenticateToken, upload.single('image'), async (req, res) => {

    const { 
        headline, 
        description, 
        lat, 
        long, 
        sortcode, 
        accountnumber,
        petwalking,
        ratewalking,
        ratewalkingaddpet,
        petboarding,
        ratepetboarding,
        ratepetboardingaddpet,
        housesitting,
        ratehousesitting,
        ratehousesittingaddpet,
        training,
        ratetraining,
        ratetrainingaddpet,
        grooming,
        rategrooming,
        rategroomingaddpet,
        pickupdropoff,
        oralmedications,
        injectmedications
    } = JSON.parse(req.body.sitter);

    var update = {}

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    if (headline != "" && headline != undefined) update.headline = headline
    if (description != "" && description != undefined) update.description = description
    if (lat != "" && lat != undefined) update.lat = lat
    if (long != "" && long != undefined) update.long = long
    if (sortcode != "" && sortcode != undefined) update.sortcode = sortcode
    if (accountnumber != "" && accountnumber != undefined) update.accountnumber = accountnumber

    if (petwalking != "" && petwalking != undefined) update.petwalking = petwalking
    if (ratewalking != "" && ratewalking != undefined) update.ratewalking = ratewalking
    if (ratewalkingaddpet != "" && ratewalkingaddpet != undefined) update.ratewalkingaddpet = ratewalkingaddpet
    if (petboarding != "" && petboarding != undefined) update.petboarding = petboarding
    if (ratepetboarding != "" && ratepetboarding != undefined) update.ratepetboarding = ratepetboarding
    if (ratepetboardingaddpet != "" && ratepetboardingaddpet != undefined) update.ratepetboardingaddpet = ratepetboardingaddpet
    if (housesitting != "" && housesitting != undefined) update.housesitting = housesitting
    if (ratehousesitting != "" && ratehousesitting != undefined) update.ratehousesitting = ratehousesitting
    if (ratehousesittingaddpet != "" && ratehousesittingaddpet != undefined) update.ratehousesittingaddpet = ratehousesittingaddpet
    if (training != "" && training != undefined) update.training = training
    if (ratetraining != "" && ratetraining != undefined) update.ratetraining = ratetraining
    if (ratetrainingaddpet != "" && ratetrainingaddpet != undefined) update.ratetrainingaddpet = ratetrainingaddpet
    if (grooming != "" && grooming != undefined) update.grooming = grooming
    if (rategrooming != "" && rategrooming != undefined) update.rategrooming = rategrooming
    if (rategroomingaddpet != "" && rategroomingaddpet != undefined) update.rategroomingaddpet = rategroomingaddpet
    if (pickupdropoff != "" && pickupdropoff != undefined) update.pickupdropoff = pickupdropoff
    if (oralmedications != "" && oralmedications != undefined) update.oralmedications = oralmedications
    if (injectmedications != "" && injectmedications != undefined) update.injectmedications = injectmedications

    const file = req.file;

    const result = {}

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
    
            try {

                await Sitter.findByIdAndUpdate(sitterExist._id, { $set: update }, { new: true });

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

        try {
            const sitter = await Sitter.findByIdAndUpdate(sitterExist._id, { $set: update }, { new: true });
            return res.status(200).json(sitter);
        } catch (err) {
            console.log(err);
            return res.status(400).json({ message: err });
        }

    }

})

module.exports = router;
