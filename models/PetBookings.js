const mongoose = require('mongoose');

const petbookingsSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        required: true
    },
    petId: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('PetBookings', petbookingsSchema);