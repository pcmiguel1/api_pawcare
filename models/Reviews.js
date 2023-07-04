const mongoose = require('mongoose');

const reviewsSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    sitterId: {
        type: String,
        required: true
    },
    rate: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Reviews', reviewsSchema);