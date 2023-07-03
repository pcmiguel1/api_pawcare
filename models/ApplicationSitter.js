const mongoose = require('mongoose');

const applicationSitterSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    sitterId: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ApplicationSitter', applicationSitter);