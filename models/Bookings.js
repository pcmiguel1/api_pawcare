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
    },
    total: {
        type: String, 
        required: true
    },
    petpicketup: {
        type: Boolean,
        default: false
    },
    timepetpicketup: {
        type: String,
        default: ""
    },
    inprogress: {
        type: Boolean,
        default: false
    },
    timeinprogress: {
        type: String,
        default: ""
    },
    returning: {
        type: Boolean,
        default: false
    },
    timereturning: {
        type: String,
        default: ""
    },
    completed: {
        type: Boolean,
        default: false
    },
    timecompleted: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model('Bookings', bookingsSchema);