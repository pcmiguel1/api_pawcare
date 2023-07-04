const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true,
        min: 6,
        max: 255
    },
    email: {
        type: String,
        required: true,
        max: 225,
        min: 6
    }, 
    password: {
        type: String,
        required: true,
        max: 1024,
        min: 6
    },
    phoneNumber: {
        type: String
    },
    dateOfBirth: {
        type: String,
        require: true
    },
    image: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    },
    verified: {
        type: Boolean,
        default: false
    },
    deleted: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('User', userSchema);