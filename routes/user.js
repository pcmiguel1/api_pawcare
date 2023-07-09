const router = require('express').Router();
const User = require('../models/User');
const Pet = require('../models/Pet');
const FavouriteSitter = require('../models/FavouriteSitter');
const Sitter = require('../models/Sitter');
const Bookings = require('../models/Bookings');
const PetBookings = require('../models/PetBookings');
const Contacts = require('../models/Contacts');
const Messages = require('../models/Messages');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../config/verifyToken');

const path = require('path')

const { Storage } = require("@google-cloud/storage");
const multer = require('multer');
const Reviews = require('../models/Reviews');

const gc = new Storage({
    keyFilename: path.join(__dirname, "../config/pawcare-390615-bb548a465c8a.json"),
    projectId: "pawcare-390615"
});

// Configure multer storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

const imagesBucket = gc.bucket('pawcare_imgs');


router.post("/pet/add", authenticateToken, upload.single('image'), async (req, res) => {

    const { name, specie, breed, gender, dateOfBirth, vaccinated, friendly, microchip } = JSON.parse(req.body.pet)

    //Validations
    if (!name) return res.status(422).json({ message: 'Name is required!' })
    if (!specie) return res.status(422).json({ message: 'Specie is required!' })
    if (!gender) return res.status(422).json({ message: 'Gender is required!' })
    if (!dateOfBirth) return res.status(422).json({ message: 'Date of birth is required!' })

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

            try {
                // Make the file public
                await imagesBucket.file(fileName).makePublic();

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

            } catch (err) {
                console.log(err);
                res.status(400).json({ message: err });
            }
        });
      
        blobStream.end(req.file.buffer);

    }
    else {

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

    }

})

router.post("/pet/update/:id", authenticateToken, upload.single('image'), async (req, res) => {

    let id = req.params.id;

    var body = JSON.parse(req.body.pet)

    var update = {}
    update = body;
    

    const petExist = await Pet.findOne({_id: id, user_id: req.userId});
    if (!petExist) return res.status(422).json({ message: "No result!" })

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

            update.photo = publicUrl;

            await Pet.findByIdAndUpdate(
                id, { $set: update }
            ).then(() => {
                return res.status(200).json({ message: "Pet updated successfully!" });
            });

        });
      
        blobStream.end(req.file.buffer);

    }
    else {

        await Pet.findByIdAndUpdate(
            id, { $set: update }
        ).then(() => {
            return res.status(200).json({ message: "Pet updated successfully!" });
        });

    }

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

    return res.status(200).json(pets)

})

router.post("/contacts/add/:id", authenticateToken, async (req, res) => {

    var id = req.params.id;

    const contactExist = await Contacts.findOne({user_id: req.userId, sitterId: id});
    if (contactExist) return res.status(400).json({ message: "Contact already exists!" })

    const contact = new Contacts({
        user_id: req.userId,
        sitterId: id
    });

    try {
        const savedContact = await contact.save();
        return res.status(200).json({ message: "Contact added!" });
    } catch (err) {
        return res.status(400).json({ message: err });
    }

})

router.get("/contacts", authenticateToken, async (req, res) => {

    const contacts = await Contacts.find({ user_id: req.userId });

    const result = [];

    for (const contact of contacts) {
        const sitter = await Sitter.findById(contact.sitterId);

        const object = { ...contact._doc };

        const user = await User.findById(sitter.user_id);

        object.image = user.image;
        object.name = user.fullname

        result.push(object);
    }

    return res.status(200).json(result);

})

router.get("/favourites", authenticateToken, async (req, res) => {

    const favourites = await FavouriteSitter.find({ user_id: req.userId });

    const result = [];

    for (const favourite of favourites) {
        const sitter = await Sitter.findById(favourite.sitterId);
        const reviews = await Reviews.find({sitterId: sitter._id})

        const object = { ...sitter._doc };

        const user = await User.findById(sitter.user_id);

        object.image = user.image;
        object.name = user.fullname
        object.reviews = reviews || []

        result.push(object);
    }

    return res.status(200).json(result);

})

router.post("/favourite/add/:id", authenticateToken, async (req, res) => {

    var id = req.params.id;

    const favouriteExist = await FavouriteSitter.findOne({user_id: req.userId, sitterId: id});
    if (favouriteExist) return res.status(400).json({ message: "Favourite already exists!" })

    //Create a new pet
    const favourite = new FavouriteSitter({
        user_id: req.userId,
        sitterId: id
    });

    try {
        const savedFavourite = await favourite.save();
        return res.status(200).json(savedFavourite);
    } catch (err) {
        return res.status(400).json({ message: err });
    }

})

router.post("/favourite/delete/:id", authenticateToken, async (req, res) => {

    var id = req.params.id;

    const favouriteExist = await FavouriteSitter.findOne({user_id: req.userId, sitterId: id});
    if (!favouriteExist) return res.status(422).json({ message: "No result!" })

    FavouriteSitter.findByIdAndDelete(favouriteExist._id, (err, result) => {
        if (err) {
            res.json({ message: err.message });
        } else {
            return res.status(200).json({ message: "Favourite deleted successfully!" });
        }
    });

})

router.get("/favourite/:id", authenticateToken, async (req, res) => {

    var id = req.params.id;

    const favourite = await FavouriteSitter.findOne({ user_id: req.userId, sitterId: id });
    if (!favourite) return res.status(422).json({ message: "No result!" })

    return res.status(200).json(favourite)

})

router.post("/booking/cancel/:id", authenticateToken, async (req, res) => {

    var id = req.params.id;

    try {
        await Bookings.findByIdAndUpdate(id, { status: "canceled" }, { new: true });
        return res.status(200).json({message: "State updated!"});
    } catch (err) {
        console.log(err);
        return res.status(400).json({ message: err });
    }

})  

router.post("/booking/add", authenticateToken, async (req, res) => {

    const { sitterId, serviceType, startDate, endDate, location, message, pets, total } = req.body;

    //Validations
    if (!sitterId) return res.status(422).json({ message: 'sitterId is required!' })
    if (!serviceType) return res.status(422).json({ message: 'serviceType is required!' })
    if (!startDate) return res.status(422).json({ message: 'startDate is required!' })
    if (!endDate) return res.status(422).json({ message: 'endDate is required!' })
    if (!location) return res.status(422).json({ message: 'location is required!' })
    if (!pets) return res.status(422).json({ message: 'pets is required!' })
    if (!total) return res.status(422).json({ message: 'total is required!' })

    const booking = new Bookings({
        user_id: req.userId,
        sitterId: sitterId,
        startDate: startDate,
        endDate: endDate,
        serviceType: serviceType,
        location: location,
        message: message || "",
        total: total
    });

    try {
        const bookingsaved = await booking.save();

        for (const pet of pets) {

            const petbooking = new PetBookings({
                bookingId: bookingsaved._id,
                petId: pet.id
            });

            await petbooking.save();

        }
        return res.status(200).json({ message: 'Booking submitted successfully!' });
    } catch (err) {
        return res.status(400).json({ message: err });
    }


})

router.get("/notifications", authenticateToken, async (req, res) => {

    const notifications = await Notifications.find({ userId: req.userId })
    return res.status(200).json(notifications);

})

router.get("/bookings/active", authenticateToken, async (req, res) => {

    const bookings = await Bookings.find({ user_id: req.userId });

    const result = [];

    for (const booking of bookings) {

        if (booking.status != "completed" && booking.status != "canceled") {
            const sitter = await Sitter.findById(booking.sitterId);

            const object = { ...booking._doc };

            const user = await User.findById(sitter.user_id);

            object.image = user.image;
            object.name = user.fullname

            result.push(object);
        }
    }

    return res.status(200).json(result);

})

router.get("/bookings/completed", authenticateToken, async (req, res) => {

    const bookings = await Bookings.find({ user_id: req.userId });

    const result = [];

    for (const booking of bookings) {

        if (booking.status == "completed" || booking.status == "canceled") {
            const sitter = await Sitter.findById(booking.sitterId);

            const review = await Reviews.findOne({ bookingId: booking._id });
        
            const object = { ...booking._doc };

            const user = await User.findById(sitter.user_id);

            object.image = user.image;
            object.name = user.fullname;
            object.review = review || {}

            result.push(object);
        }
    }

    return res.status(200).json(result);

})

router.post("/delete", authenticateToken, async (req, res) => {

    await User.findByIdAndUpdate(
        req.userId, { deleted: true } , { new: true }
    ).then((result) => {
        return res.status(200).json({ message: 'User deleted successfully!' });
    });

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
            req.userId, { $set: update } , { new: true }
        ).then((result) => {
            return res.status(200).json(result);
        });

    }

})

router.post("/chat/send", authenticateToken, async (req, res) => {

    const { message, senderId, senderName, receiverId, receiverName } = req.body;
    
    //Validations
    if (!message) return res.status(422).json({ message: 'message is required!' })
    if (!senderId) return res.status(422).json({ message: 'senderId is required!' })
    if (!senderName) return res.status(422).json({ message: 'senderName is required!' })
    if (!receiverId) return res.status(422).json({ message: 'receiverId is required!' })
    if (!receiverName) return res.status(422).json({ message: 'receiverName is required!' })

    const chat = new Messages({
        message: message,
        sender: {
            id: senderId,
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

    const messages = await Messages.find({
        $or: [
          {
            "sender.id": req.userId,
            "receiver.id": receiver
          },
          {
            "sender.id": receiver,
            "receiver.id": req.userId
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

    var id = req.params.id;

    const user = await User.findById(id);

    return res.status(200).json(user);

})

module.exports = router;
