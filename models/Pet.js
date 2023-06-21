const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        min: 6,
        max: 255,
        required: true
    },
    breed: {
        type: String,
        required: true
    },
    sex: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: ""
    },
    photo: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model('Pet', petSchema);