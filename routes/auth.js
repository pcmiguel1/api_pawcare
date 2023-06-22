const router = require('express').Router();
const User = require('../models/User');
const UserVerification = require('../models/UserVerification');
const ForgotPasswordVerification = require('../models/ForgotPasswordVerification');
const {v4: uuidv4} = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path')
const hbs = require('nodemailer-express-handlebars');
const { authenticateToken } = require('../config/verifyToken');

const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'support@pawcare.app',
        pass: 'Comidafix123a@'
    }
});


router.post("/login2", (req, res) => {
    const token = jwt.sign({ _id: "123a", role: "user" }, process.env.TOKEN_SECRET, { expiresIn: '2h', issuer: process.env.ISSUER_JWT });
    res.json({ accessToken: token })
})

router.post("/login", authenticateToken, async (req, res) => {

    const { email, password } = req.body;
    const result = {}
    
    //Validations
    if (!email) return res.status(422).json({ message: 'Email is required!' })
    if (!password) return res.status(422).json({ message: 'Password is required!' })
    
    //Checking if email exists and is verified
    await User.findOne({email: email})
        .then(async function (user) {

            if (!user) return res.status(404).json({message: "Wrong credentials"});

            if (user.verified) {

                //PASSWORD IS CORRECT
                const validPass = await bcrypt.compare(password, user.password);
                if (!validPass) return res.status(404).json({message: "Wrong credentials"});

                //Create and assign a token
                const token = jwt.sign({_id: user._id}, process.env.TOKEN_SECRET, { expiresIn: '1h', issuer: process.env.ISSUER_JWT });

                result.user = user;
                result.token = token;

                res.status(200).json(result);

            }
            else {
                return res.status(400).json({message: "Wrong credentials"}); 
            }

        })
        .catch(() => {
            res.status(500).send({message: err.message || "Error Occured while retriving information."})
        })

})

router.post("/register", authenticateToken, async (req, res) => {

    //LETS VALIDATE THE DATA BEFORE WE A USER
    const { fullname, dateOfBirth, phoneNumber, email, password } = req.body;
    if (!fullname) return res.status(422).json({ message: 'fullname is required!' })
    if (!dateOfBirth) return res.status(422).json({ mmessagesg: 'dateOfBirth is required!' })
    //if (!phoneNumber) return res.status(422).json({ message: 'phoneNumber is required!' })
    if (!email) return res.status(422).json({ message: 'email is required!' })
    if (!password) return res.status(422).json({ message: 'password is required!' })

    //Checking if the user is already in the database and is already verified
    const emailExist = await User.findOne({email: email, verified: true});
    if (emailExist) return res.status(400).json({ message: "Email already exists." })

    //const phoneNumberExist = await User.findOne({phoneNumber: phoneNumber});
    //if (phoneNumberExist) return res.status(400).json({ message: "PhoneNumber already exists." })

    //HASH passwords
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    //Create a new user
    const user = new User({
        fullname: fullname,
        email: email,
        password: hashPassword,
        dateOfBirth: dateOfBirth,
        //phoneNumber: phoneNumber,
        image: req.body.image
    });

    try {
        const savedUser = await user.save()
        .then((result) => {
            sendVerificationEmail(result, res);
        })
        .catch((err) => {
            res.status(400).send(err);
        })
    
        //res.status(200).json(savedUser);
    } catch(err) {
        res.status(400).send(err);
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

    const handlebarOptions = {
        viewEngine: {
            extName: ".handlebars",
            partialsDir: path.resolve('./views'),
            defaultLayout: false
        },
        viewPath: path.resolve('./views'),
        extName: ".handlebars"
    }

    transporter.use('compile', hbs(handlebarOptions));

    //var url = currentUrl + "auth/verify/" + _id + "/" + uniqueString

    const randomNumber = Math.floor(Math.random() * 9000) + 1000;

    //mail options
    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Verify your Email",
        html: `<p>Code to confirm Email is valid for 1h: <b>${randomNumber}</b></p>`,
        template: 'verifyemail',
        context: {
            url: randomNumber
        }
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

/*//LOGIN
router.post('/login', async (req, res) => {

    const { email, password } = req.body;
    const result = {}
    
    //Validations
    if (!email) return res.status(422).json({ message: 'Email is required!' })
    if (!password) return res.status(422).json({ message: 'Password is required!' })
    
    //Checking if email exists
    await User.findOne({email: email})
        .then(async function (user) {

            if (!user) return res.status(404).send({status: 404, message: "Wrong credentials"});

            //PASSWORD IS CORRECT
            const validPass = await bcrypt.compare(req.body.password, user.password);
            if (!validPass) return res.status(404).send({status: 404, message: "Wrong credentials"});

            //Create and assign a token
            const token = jwt.sign({_id: user._id}, process.env.TOKEN_SECRET, { expiresIn: '30m' });

            result.user = user;
            result.token = token;

            //res.status(200).json(result);

            res.cookie("access_token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
            }).status(200).redirect('/dashboard');

        })
        .catch(() => {
            res.status(500).send({message: err.message || "Error Occured while retriving information."})
        })

});*/