const mongoose = require('mongoose');

const statusbookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    time: {
        type: String, 
        require: true
    }
});

module.exports = mongoose.model('StatusBooking', statusbookingSchema);