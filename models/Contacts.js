const mongoose = require('mongoose');

const contactsSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    sitterId: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Contacts', contactsSchema);