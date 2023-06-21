const express = require('express');
var path = require('path');
const app = express();
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cookieParser = require("cookie-parser");

const session = require("express-session")
const admin = require('firebase-admin');

const bodyParser = require('body-parser');

//Import Routes

const authApp = require('./routes/auth');

//APP

dotenv.config();
app.use(cookieParser());

app.use(bodyParser.json({ limit: '5000mb' }));
app.use(bodyParser.urlencoded({ limit: '5000mb', extended: true }));

//Connect to DB
mongoose.connect(
    process.env.DB_CONNECT,
    () => console.log('connected to db!')
);


//Middleware
//app.engine('html', require('ejs').renderFile);
//app.set('view engine', 'ejs'); // ejs
//app.set('views', path.join(__dirname, '/public'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: process.env.TOKEN_SECRET,
    resave: false, // We wont resave the session variable if nothing is changed
    saveUninitialized: false
}))


app.use(express.static(path.join(__dirname, 'public')));


//Route Middlewares

app.use('/app/api/auth', authApp);
//app.use('/app/api/user', userApp);
//app.use('/app/api/notification', notificationApp);

app.use('/images', express.static(path.join(__dirname, 'images')))

port = process.env.PORT || 3000
app.listen(port, () => console.log('Server Up and running'));