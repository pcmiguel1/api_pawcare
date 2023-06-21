const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Notification', notificationSchema);