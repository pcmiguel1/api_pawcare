const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        min: 6,
        max: 255,
        required: true
    },
    photo: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model('Apps', petSchema);