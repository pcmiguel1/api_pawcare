const router = require('express').Router();
const User = require('../models/User');
const UserVerification = require('../models/UserVerification');
const ForgotPasswordVerification = require('../models/ForgotPasswordVerification');
const Sitter = require('../models/Sitter');
const {v4: uuidv4} = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path')
const hbs = require('nodemailer-express-handlebars');
const { authenticateToken } = require('../config/verifyToken');

const { Storage } = require("@google-cloud/storage");
const multer = require('multer');

const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

const gc = new Storage({
    keyFilename: path.join(__dirname, "../config/pawcare-390615-bb548a465c8a.json"),
    projectId: "pawcare-390615"
});

// Configure multer storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

const imagesBucket = gc.bucket('pawcare_imgs');


router.post("/login2", (req, res) => {
    const token = jwt.sign({ _id: "123a", role: "user" }, process.env.TOKEN_SECRET, { expiresIn: '10h', issuer: process.env.ISSUER_JWT });
    res.json({ accessToken: token })
})

router.post("/login", authenticateToken, async (req, res) => {

    const { email, password } = req.body;
    
    //Validations
    if (!email) return res.status(422).json({ message: 'Email is required!' })
    if (!password) return res.status(422).json({ message: 'Password is required!' })
    
    //Checking if email exists and is verified
    await User.findOne({email: email})
        .then(async function (user) {

            if (!user) return res.status(404).json({message: "Wrong credentials"});

            if (user.verified) {

                if (!user.deleted) {

                    //PASSWORD IS CORRECT
                    const validPass = await bcrypt.compare(password, user.password);
                    if (!validPass) return res.status(404).json({message: "Wrong credentials"});

                    const sitterExist = await Sitter.findOne({user_id: user._id.toString()});

                    //Create and assign a token
                    const token = jwt.sign({_id: user._id}, process.env.TOKEN_SECRET, { expiresIn: '10h', issuer: process.env.ISSUER_JWT });

                    var resultUser = { ...user._doc };
                    if (sitterExist) resultUser.sitterId = sitterExist._id.toString()

                    var result = {}

                    result.user = resultUser;
                    result.token = token;

                    res.status(200).json(result);   

                }
                else {
                    return res.status(400).json({message: "Wrong credentials"}); 
                }

            }
            else {
                return res.status(400).json({message: "Wrong credentials"}); 
            }

        })
        .catch(() => {
            res.status(500).send({message: err.message || "Error Occured while retriving information."})
        })

})

router.post("/register", authenticateToken, upload.single('image'), async (req, res) => {



    //LETS VALIDATE THE DATA BEFORE WE A USER
    const { fullname, dateOfBirth, phoneNumber, email, password } = JSON.parse(req.body.user);

    if (!fullname) return res.status(422).json({ message: 'fullname is required!' })
    if (!dateOfBirth) return res.status(422).json({ message: 'dateOfBirth is required!' })
    //if (!phoneNumber) return res.status(422).json({ message: 'phoneNumber is required!' })
    if (!email) return res.status(422).json({ message: 'email is required!' })
    if (!password) return res.status(422).json({ message: 'password is required!' })
    
    const file = req.file;

    //Checking if the user is already in the database and is already verified
    const emailExist = await User.findOne({email: email});
    if (emailExist) return res.status(400).json({ message: "Email already exists." })

    //const phoneNumberExist = await User.findOne({phoneNumber: phoneNumber});
    //if (phoneNumberExist) return res.status(400).json({ message: "PhoneNumber already exists." })

    //HASH passwords
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    //upload image if exists
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

                //Create a new user
                const user = new User({
                    fullname: fullname,
                    email: email,
                    password: hashPassword,
                    dateOfBirth: dateOfBirth,
                    phoneNumber: phoneNumber,
                    image: publicUrl
                });

                try {
                    const savedUser = await user.save()
                    .then((result) => {
                        sendVerificationEmail(result, res);
                        //return res.status(200).json(result);
                    })
                    .catch((err) => {
                        res.status(400).json({ message: err });
                    })

                } catch(err) {
                    res.status(400).json({ message: err });
                }


            } catch (err) {
                console.log(err);
                res.status(400).json({ message: err });
            }
        });
      
        blobStream.end(req.file.buffer);

    }
    else {

        //Create a new user
        const user = new User({
            fullname: fullname,
            email: email,
            password: hashPassword,
            dateOfBirth: dateOfBirth,
            phoneNumber: phoneNumber
        });

        try {
            const savedUser = await user.save()
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

    }

})

router.get("/services", (req, res) => {

    var services = []

    res.status(200).json(services);
})

router.post("/sendVerificationEmailForgotPassword", authenticateToken, async (req, res) => {

    //LETS VALIDATE THE DATA BEFORE WE A USER
    const { email } = req.body;
    if (!email) return res.status(422).json({ message: 'Email is required!' })


    //Checking if the user is already in the database and is already verified
    const emailExist = await User.findOne({email: email, verified: true});

    if (!emailExist) return res.status(400).json({ message: "Account doesn't exist!" })

    sendVerificationEmailForgotPassword(emailExist, res);

})

//sent verification email forgot password
const sendVerificationEmailForgotPassword = async (user, res) => {

    const { _id, email } = user;

    const randomNumber = Math.floor(Math.random() * 9000) + 1000;

    //mail options
    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Reset Password Code",
        html: `<p>Code to reset the password is valid for 1h: <b>${randomNumber}</b></p>`
    }

    const newVerification = new ForgotPasswordVerification({
        userId: _id,
        code: randomNumber,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    });

    ForgotPasswordVerification
    .find({userId: _id})
    .then((result) => {
        if (result.length > 0) {
            //user verification record exists so delete and create a new one

            ForgotPasswordVerification
                    .deleteOne({userId: _id})
                    .then(result => {
                        newVerification
                                .save()
                                .then(() => {
                                    transporter
                                    .sendMail(mailOptions)
                                    .then(() => {
                                        //email sent and verification record saved
                                        console.log(`Forgot Password Verification email sent ${randomNumber}`)
                                        //res.status(200).json({ message: "Forgot password verification email sent." });
                                        res.status(200).json({userId: _id});
                                    })
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
                transporter
                .sendMail(mailOptions)
                .then(() => {
                    //email sent and verification record saved
                    console.log(`Forgot Password Verification email sent ${randomNumber}`)
                    //res.status(200).json({ message: "Forgot password verification email sent." });
                    res.status(200).json({userId: _id});
                })
            })
            .catch((err) => {
                res.status(400).json({ message: err })
            })

        }
    })
    .catch((err) => {
        res.status(400).json({ message: err })
    })

}

//verify email
router.get('/verifyForgotPasswordCode/:userId/:code', authenticateToken, (req, res) => {

    let { userId, code } = req.params;

    //LETS VALIDATE THE DATA BEFORE WE A USER
    if (!userId) return res.status(422).json({ message: 'UserId is required!' })
    if (!code) return res.status(422).json({ mmessagesg: 'Code is required!' })

    // Check if userId is a valid format (e.g. a UUID)
    const uuidRegex = /^[0-9a-fA-F]{24}$/;
    if (!uuidRegex.test(userId)) {
        return res.status(400).json({ message: 'Invalid userId format' });
    }

    // Check if code is a valid format (e.g. a 6-digit number)
    const codeRegex = /^[0-9]{4}$/;
    if (!codeRegex.test(code)) {
        return res.status(400).json({ message: 'Invalid code format' });
    }

    ForgotPasswordVerification
        .find({userId})
        .then((result) => {
            if (result.length > 0) {
                //user verification record exists so we proceed
                
                const {expiresAt} = result[0];
                const codeString = result[0].code;

                //checking for expired unique string
                if (expiresAt < Date.now()) {
                    //record has expired so we delete it
                    ForgotPasswordVerification
                        .deleteOne({userId})
                        .then(result => {
                            User
                                .deleteOne({_id: userId})
                                .then(() => {
                                    res.status(400);
                                })
                                .catch((err) => {
                                    res.status(400).json({ message: err })
                                })
                        })
                        .catch((err) => {
                            res.status(400).json({ message: err })
                        })
                } else {

                    //valid record exists so we validate the user string
                    //First compare the hashed unique string

                    if (code == codeString) {

                        res.status(200).json({ message: 'Forgot Password Code verified successfully!' })
                    } 
                    else {
                        // existing record but incorrect verification details passed
                        res.status(400).json({ message: "Incorrect code!" })
                    }

                }

            } else {
                //user verification record doesn't exist
                res.status(400).json({ message: "Incorrect code!" })
            }
        })
        .catch((err) => {
            res.status(400).json({ message: err })
        })

})

//reset password
router.post('/resetPassword', authenticateToken, async (req, res) => {

    let { userId, newPassword, code } = req.body;

    //LETS VALIDATE THE DATA BEFORE WE A USER
    if (!userId) return res.status(422).json({ message: 'UserId is required!' })
    if (!newPassword) return res.status(422).json({ mmessagesg: 'newPassword is required!' })
    if (!code) return res.status(422).json({ mmessagesg: 'code is required!' })

    //HASH passwords
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(newPassword, salt);
    
    ForgotPasswordVerification
        .find({userId})
        .then((result) => {
            if (result.length > 0) {
                //user verification record exists so we proceed
                
                const {expiresAt} = result[0];
                const codeString = result[0].code;

                //checking for expired unique string
                if (expiresAt < Date.now()) {
                    //record has expired so we delete it
                    ForgotPasswordVerification
                        .deleteOne({userId})
                        .then(result => {
                            User
                                .deleteOne({_id: userId})
                                .then(() => {
                                    res.status(400).json({ message: 'Error resetting password!' })
                                })
                                .catch((err) => {
                                    res.status(400).json({ message: err })
                                })
                        })
                        .catch((err) => {
                            res.status(400).json({ message: err })
                        })
                } else {

                    //valid record exists so we validate the user string
                    //First compare the hashed unique string

                    if (code == codeString) {

                        ForgotPasswordVerification
                            .deleteOne({userId})
                            .then(() => {
                                User
                                .updateOne({_id: userId}, {password: hashPassword})
                                .then(() => {
                                    res.status(200).json({ message: 'Password has been reset successfully!' })
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
                        res.status(400).json({ message: "Incorrect code!" })
                    }

                }

            } else {
                //user verification record doesn't exist
                res.status(400).json({ message: "Incorrect code!" })
            }
        })
        .catch((err) => {
            res.status(400).json({ message: err })
        })

})

//sent verification email
const sendVerificationEmail = async (user, res) => {
    //url to be used in the email
    //const currentUrl = "http://192.168.68.118:3000/app/api/";
    const { _id, email } = user;

    //const uniqueString = uuidv4() + _id;

    //var url = currentUrl + "auth/verify/" + _id + "/" + uniqueString

    const randomNumber = Math.floor(Math.random() * 9000) + 1000;

    //mail options
    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Verify your Email",
        html: `<p>Code to confirm Email is valid for 1h: <b>${randomNumber}</b></p>`,
    }

    const newVerification = new UserVerification({
        userId: _id,
        code: randomNumber,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    });

    UserVerification
    .find({_id})
    .then((result) => {
        if (result.length > 0) {
            //user verification record exists so delete and create a new one

            UserVerification
                    .deleteOne({_id})
                    .then(result => {
                        User
                            .deleteOne({_id: _id})
                            .then(() => {
                                
                                newVerification
                                .save()
                                .then(() => {
                                    transporter
                                    .sendMail(mailOptions)
                                    .then(() => {
                                        //email sent and verification record saved
                                        console.log(`Verification email sent ${randomNumber}`)
                                        res.status(200).json(user);
                                    })
                                })
                                .catch((err) => {
                                    res.status(400).json({ message: err })
                                })

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
                transporter
                .sendMail(mailOptions)
                .then(() => {
                    //email sent and verification record saved
                    console.log(`Verification email sent ${randomNumber}`)
                    res.status(200).json(user);
                })
            })
            .catch((err) => {
                res.status(400).json({ message: err })
            })

        }
    })
    .catch((err) => {
        res.status(400).json({ message: err })
    })

}

//verify email
router.get('/verify/:userId/:code', authenticateToken, (req, res) => {
    let { userId, code } = req.params;

    UserVerification
        .find({userId})
        .then((result) => {
            if (result.length > 0) {
                //user verification record exists so we proceed
                
                const {expiresAt} = result[0];
                const codeString = result[0].code;

                //checking for expired unique string
                if (expiresAt < Date.now()) {
                    //record has expired so we delete it
                    UserVerification
                        .deleteOne({userId})
                        .then(result => {
                            User
                                .deleteOne({_id: userId})
                                .then(() => {
                                    res.status(400);
                                })
                                .catch((err) => {
                                    res.status(400).json({ message: err })
                                })
                        })
                        .catch((err) => {
                            res.status(400).json({ message: err })
                        })
                } else {

                    //valid record exists so we validate the user string
                    //First compare the hashed unique string

                    if (code == codeString) {

                        User
                        .updateOne({_id: userId}, {verified: true})
                        .then(() => {
                            UserVerification
                                .deleteOne({userId})
                                .then(() => {
                                    res.status(200).json({ message: 'Email verified successfully!' })
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
                        res.status(400).json({ message: "Incorrect code!" })
                    }

                }

            } else {
                //user verification record doesn't exist
                res.status(400).json({ message: "Incorrect code!" })
            }
        })
        .catch((err) => {
            res.status(400).json({ message: err })
        })

})

module.exports = router;