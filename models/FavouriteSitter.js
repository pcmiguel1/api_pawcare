const mongoose = require('mongoose');

const favouriteSitterSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    sitterId: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('FavouriteSitter', favouriteSitterSchema);