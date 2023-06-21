const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    name: {
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
    phone: {
        type: Number,
        min: 9
    },
    photo: {
        type: String,
        default: ""
    },
    date: {
        type: Date,
        default: Date.now
    },
    admin: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('UserWeb', adminSchema);