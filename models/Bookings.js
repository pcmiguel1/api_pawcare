const mongoose = require('mongoose');

const bookingsSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    sitterId: {
        type: String,
        required: true
    },
    startDate: {
        type: String,
        required: true
    },
    endDate: {
        type: String,
        required: true
    },
    serviceType: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: "pending"
    },
    location: {
        type: String
    },
    message: {
        type: String
    }
});

module.exports = mongoose.model('Bookings', bookingsSchema);