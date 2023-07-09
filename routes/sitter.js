const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const Sitter = require('../models/Sitter');
const PictureImage = require('../models/PictureSitter');
const Bookings = require('../models/Bookings');
const PhoneVerification = require('../models/PhoneVerification');
const ApplicationSitter = require('../models/ApplicationSitter');
const Messages = require('../models/Messages');
const Reviews = require('../models/Reviews');
const Contacts = require('../models/Contacts');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../config/verifyToken');
const path = require('path')

const { Storage } = require("@google-cloud/storage");
const multer = require('multer');
const { json } = require('body-parser');

const twilio = require('twilio');

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

router.get("/contacts", authenticateToken, async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    const contacts = await Contacts.find({ sitterId: sitterExist._id });

    const result = [];

    for (const contact of contacts) {
        const object = { ...contact._doc };

        const user = await User.findById(contact.user_id);

        object.image = user.image;
        object.name = user.fullname

        result.push(object);
    }


    return res.status(200).json(result);

})

router.get("/list", authenticateToken, async (req, res) => {
    
    const { latitude, longitude, service } = req.query;

    var find = {}

    if (service != undefined) {

        let serviceArray = [];
        if (typeof service === "string") {
            serviceArray.push(service); // Convert the string to an array
        } else if (Array.isArray(service)) {
            serviceArray = service; // Use the existing array
        }

        for (const serv of serviceArray) {
            if (serv == "petwalking") find.petwalking = true
            if (serv == "training") find.training = true
            if (serv == "petboarding") find.petboarding = true
            if (serv == "grooming") find.grooming = true 
            if (serv == "housesitting") find.housesitting = true
        }
    }

    try {
        let sitters;
        if (Object.keys(find).length !== 0) {
            const query = { verified: true, user_id: { $ne: req.userdId }, $or: Object.entries(find).map(([key, value]) => ({ [key]: value })) };
            sitters = await Sitter.find(query);
        } else {
        sitters = await Sitter.find({ verified: true, user_id: { $ne: req.userId } });
        }

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
                        const reviews = await Reviews.find({sitterId: sitter._id})
                        object.name = user.fullname;
                        object.image = user.image;
                        object.reviews = reviews || []
                        return object;
                    }
                } else {
                    const user = await User.findById(user_id);
                    const reviews = await Reviews.find({sitterId: sitter._id})
                    object.name = user.fullname;
                    object.image = user.image;
                    object.reviews = reviews || []
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

router.get("/bookings", authenticateToken, async (req, res) => {
    const { month, year } = req.query;
  
    const sitter = await Sitter.findOne({ user_id: req.userId });
  
    let bookings = await Bookings.find({ sitterId: sitter._id });
  
    bookings = bookings.filter(booking => {
      const [bookingDay, bookingMonth, bookingYear] = booking.startDate.split("-");

        console.log(bookingMonth + " " + bookingYear)

      return Number(bookingMonth) === Number(month) && Number(bookingYear) === Number(year);
    });
  
    bookings.sort((a, b) => {
      const dateA = new Date(a.startDate.split("-").reverse().join("-"));
      const dateB = new Date(b.startDate.split("-").reverse().join("-"));
      return dateA - dateB;
    });
  
    console.log(bookings.map(booking => booking.startDate)); // Sorted array of startDate values within the specified month and year
  
    return res.status(200).json(bookings);
});

router.get("/income", authenticateToken, async (req, res) => {

    const sitterExist = await Sitter.findOne({user_id: req.userId});
    if (!sitterExist) return res.status(400).json({ message: "User is not a sitter!" })

    var result = {}

    var totalWalking = 0.0
    var totalBoarding = 0.0
    var totalHouseSitting = 0.0
    var totalTraining = 0.0
    var totalGrooming = 0.0

    var active = 0
    var finished = 0
    var canceled = 0

    var bookings = await Bookings.find({sitterId: sitterExist._id})

    for (const booking of bookings) {

        if (booking.serviceType == "petwalking" && booking.status == "completed") totalWalking += parseFloat(booking.total);
        if (booking.serviceType == "petboarding" && booking.status == "completed") totalBoarding += parseFloat(booking.total);
        if (booking.serviceType == "housesitting" && booking.status == "completed") totalHouseSitting += parseFloat(booking.total);
        if (booking.serviceType == "pettraning" && booking.status == "completed") totalTraining += parseFloat(booking.total);
        if (booking.serviceType == "petgrooming" && booking.status == "completed") totalGrooming += parseFloat(booking.total);

        if (booking.status == "started") active++;
        if (booking.status == "completed") finished++;
        if (booking.status == "canceled") canceled++;

    }

    result.totalWalking = totalWalking;
    result.totalBoarding = totalBoarding;
    result.totalHouseSitting = totalHouseSitting;
    result.totalTraining = totalTraining;
    result.totalGrooming = totalGrooming;

    result.active = active;
    result.finished = finished;
    result.canceled = canceled;

    result.total = totalWalking + totalBoarding + totalHouseSitting + totalTraining + totalGrooming;

    
    return res.status(200).json(result)

})

router.post("/booking/update/:id", authenticateToken, async (req, res) => {

    var id = req.params.id;

    let booking = await Bookings.findById(id);

    var update = {}

    const currentTime = new Date();
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');

    if (booking.status == "pending") {

        update.status = "started"

    }
    else {

        if (!booking.petpicketup && !booking.inprogress && !booking.returning && !booking.completed) {

            update.petpicketup = true
            update.timepetpicketup = `${hours}:${minutes}`
    
        }
    
        if (booking.petpicketup && !booking.inprogress && !booking.returning && !booking.completed) {
    
            update.inprogress = true
            update.timeinprogress = `${hours}:${minutes}`
    
        }
    
        if (booking.petpicketup && booking.inprogress && !booking.returning && !booking.completed) {
    
            update.returning = true
            update.timereturning = `${hours}:${minutes}`
    
        }
    
        if (booking.petpicketup && booking.inprogress && booking.returning && !booking.completed) {
    
            update.completed = true
            update.timecompleted = `${hours}:${minutes}`
            update.status = "completed"
    
        }

    }

    try {
        const bookingupdated = await Bookings.findByIdAndUpdate(id, { $set: update }, { new: true });
        return res.status(200).json(bookingupdated);
    } catch (err) {
        console.log(err);
        return res.status(400).json({ message: err });
    }



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
                    sendVerificationCode(phoneNumber, randomNumber)
            
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
                sendVerificationCode(phoneNumber, randomNumber)

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

function sendVerificationCode(phoneNumber, verificationCode) {

    // Your Twilio account SID and auth token
    const accountSid = process.env.ACCOUNT_SID
    const authToken = process.env.AUTH_TOKEN

    // Create a new Twilio client
    const client = twilio(accountSid, authToken);

    // Twilio phone number from which you want to send the SMS
    const twilioPhoneNumber = '+16183684041';
  
    // Message to send
    const message = `Your verification code is: ${verificationCode}`;
  
    // Send SMS
    client.messages
      .create({
        body: message,
        from: twilioPhoneNumber,
        to: '+' + phoneNumber
      })
      .then(message => console.log(`SMS sent. SID: ${message.sid}`))
      .catch(err => console.error(err));
  }

router.get("/:id/reviews", authenticateToken, async (req, res) => {

    let id = req.params.id;

    const reviews = await Reviews.find({sitterId: id});

    const result = [];

    for (const review of reviews) {

        const userExist = await User.findById(review.user_id);

        const object = { ...review._doc };

        object.user = userExist || {}

        result.push(object);
    }

    return res.status(200).json(result);

})

router.post("/:id/reviews/add", authenticateToken, async (req, res) => {

    let id = req.params.id;

    const { rate, message, bookingId } = req.body;

    //Validations
    if (!rate) return res.status(422).json({ message: 'rate is required!' })
    if (!message) return res.status(422).json({ message: 'message is required!' })

    const review = new Reviews({
        user_id: req.userId,
        sitterId: id,
        bookingId: bookingId,
        rate: rate,
        message: message
    });

    try {
        const savedreview = await review.save();
        return res.status(200).json(savedreview);
    } catch (err) {
        return res.status(400).json({ message: err });
    }

})

router.get("/", authenticateToken, async (req, res) => {

    let id = req.userId;

    const sitterExist = await Sitter.findOne({user_id: id});
    if (!sitterExist) return res.status(422).json({ message: "No result!" })

    return res.status(200).json(sitterExist);

})

router.post("/chat/send", authenticateToken, async (req, res) => {

    const { message, senderId, senderName, receiverId, receiverName } = req.body;
    
    //Validations
    if (!message) return res.status(422).json({ message: 'message is required!' })
    if (!senderId) return res.status(422).json({ message: 'senderId is required!' })
    if (!senderName) return res.status(422).json({ message: 'senderName is required!' })
    if (!receiverId) return res.status(422).json({ message: 'receiverId is required!' })
    if (!receiverName) return res.status(422).json({ message: 'receiverName is required!' })

    const sitterExist = await Sitter.findOne({user_id: senderId});

    const chat = new Messages({
        message: message,
        sender: {
            id: sitterExist._id.toString(),
            name: senderName
        },
        receiver: {
            id: receiverId,
            name: receiverName
        }
    });

    try {
        const savedchat = await chat.save();
        return res.status(200).json(savedchat);
    } catch (err) {
        return res.status(400).json({ message: err });
    }

})

router.get("/chat/messages/:id", authenticateToken, async (req, res) => {

    var receiver = req.params.id;

    const sitterExist = await Sitter.findOne({user_id: req.userId});

    const messages = await Messages.find({
        $or: [
          {
            "sender.id": sitterExist._id.toString(),
            "receiver.id": receiver
          },
          {
            "sender.id": receiver,
            "receiver.id": sitterExist._id.toString()
          }
        ]
      })
        .sort({ createdat: -1 })
        .exec();

    const data = []

    for (const message of messages) {

        const object = { ...message._doc };

        data.push(object);
    }

    data.reverse();

    return res.status(200).json(data);

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
