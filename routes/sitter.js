const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const Sitter = require('../models/Sitter');
const PictureImage = require('../models/PictureSitter');
const PhoneVerification = require('../models/PhoneVerification');
const ApplicationSitter = require('../models/ApplicationSitter');
const Reviews = require('../models/Reviews');
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

router.post("/application/submit", authenticateToken, async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const applicationSitter = new ApplicationSitter({
        user_id: req.userId,
        sitterId: sitterExist._id
    });

    try {
        await applicationSitter.save()
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

router.get("/application", authenticateToken, async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const applicationSitter = await ApplicationSitter.findOne({user_id: req.userId});
    return res.status(200).json(applicationSitter);

})

router.get("/pictures", authenticateToken, async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const pictures = await PictureImage.find({user_id: req.userId});
    return res.status(200).json(pictures);

})

router.get("/pictures/:id", authenticateToken, async (req, res) => {

    var id = req.params.id;

    const sitterExist = await Sitter.findOne({user_id: id});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const pictures = await PictureImage.find({user_id: id});
    return res.status(200).json(pictures);

})

router.get("/list", authenticateToken, async (req, res) => {
    
    const { latitude, longitude, service } = req.query;

    console.log(service);

    try {
        const sitters = await Sitter.find({ verified: true });

        if (!sitters || sitters.length === 0) {
            return res.status(422).json({ message: "No results!" });
        }

        const result = await Promise.all(
            sitters.map(async (sitter) => {
                const { lat, long, user_id } = sitter;

                const object = { ...sitter._doc };

                if (latitude !== undefined && latitude != "0" && longitude !== undefined && longitude != "0") {
                    const distance = calculateDistance(latitude, longitude, lat, long);
                    if (distance <= 20) {
                        const user = await User.findById(user_id);
                        object.name = user.fullname;
                        object.image = user.image;
                        return object;
                    }
                } else {
                    const user = await User.findById(user_id);
                    object.name = user.fullname;
                    object.image = user.image;
                    return object;
                }
            })
        );

        const filteredResult = result.filter(Boolean); // Remove any null or undefined values

        return res.status(200).json(filteredResult);
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});

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

router.get("/:id/reviews", async (req, res) => {

    let id = req.params.id;

    const reviews = await Reviews.find({sitterId: id});
    return res.status(200).json(reviews);



})

router.get("/", authenticateToken, async (req, res) => {

    let id = req.userId;

    const sitterExist = await Sitter.findOne({user_id: id});
    if (!sitterExist) return res.status(422).json({ message: "No result!" })

    return res.status(200).json(sitterExist);

})

router.get("/:id", authenticateToken, async (req, res) => {

    let id = req.params.id;

    var result = {};

    const sitterExist = await Sitter.findById(id);

    const object = { ...sitterExist._doc };

    const user = await User.findById(sitterExist.user_id);

    object.image = user.image;
    object.name = user.fullname

    result = object;


    return res.status(200).json(result);

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

    //JSON.parse(req.body.sitter);

    var update = {}

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    if (headline != "" && headline != undefined) update.headline = headline
    if (description != "" && description != undefined) update.description = description
    if (lat != "" && lat != undefined) update.lat = lat
    if (long != "" && long != undefined) update.long = long
    if (sortcode != "" && sortcode != undefined) update.sortcode = sortcode
    if (accountnumber != "" && accountnumber != undefined) update.accountnumber = accountnumber

    if (petwalking != undefined) update.petwalking = petwalking
    if (ratewalking != "" && ratewalking != undefined) update.ratewalking = ratewalking
    if (ratewalkingaddpet != "" && ratewalkingaddpet != undefined) update.ratewalkingaddpet = ratewalkingaddpet
    if (petboarding != undefined) update.petboarding = petboarding
    if (ratepetboarding != "" && ratepetboarding != undefined) update.ratepetboarding = ratepetboarding
    if (ratepetboardingaddpet != "" && ratepetboardingaddpet != undefined) update.ratepetboardingaddpet = ratepetboardingaddpet
    if (housesitting != undefined) update.housesitting = housesitting
    if (ratehousesitting != "" && ratehousesitting != undefined) update.ratehousesitting = ratehousesitting
    if (ratehousesittingaddpet != "" && ratehousesittingaddpet != undefined) update.ratehousesittingaddpet = ratehousesittingaddpet
    if (training != undefined) update.training = training
    if (ratetraining != "" && ratetraining != undefined) update.ratetraining = ratetraining
    if (ratetrainingaddpet != "" && ratetrainingaddpet != undefined) update.ratetrainingaddpet = ratetrainingaddpet
    if (grooming != undefined) update.grooming = grooming
    if (rategrooming != "" && rategrooming != undefined) update.rategrooming = rategrooming
    if (rategroomingaddpet != "" && rategroomingaddpet != undefined) update.rategroomingaddpet = rategroomingaddpet
    if (pickupdropoff != undefined) update.pickupdropoff = pickupdropoff
    if (oralmedications != undefined) update.oralmedications = oralmedications
    if (injectmedications != undefined) update.injectmedications = injectmedications

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

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

module.exports = router;
