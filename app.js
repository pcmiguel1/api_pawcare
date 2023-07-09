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
const userApp = require('./routes/user');
const sitterApp = require('./routes/sitter');
const notificationApp = require('./routes/notification');

const serviceAccount = require('./config/pawcare-c3b05-firebase-adminsdk-zp3lb-d9b211d844.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//APP

dotenv.config();
app.use(cookieParser());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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


app.use(express.static(path.join(__dirname, 'public')));


//Route Middleware

app.use('/api/auth', authApp);
app.use('/api/user', userApp);
app.use('/api/sitter', sitterApp);
app.use('/api/notification', notificationApp);

app.use('/images', express.static(path.join(__dirname, 'images')))

port = process.env.PORT || 3000
app.listen(port, () => console.log('Server Up and running'));

module.exports = app;