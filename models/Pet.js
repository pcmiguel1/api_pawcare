const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    specie: {
        type: String, 
        require: true
    },
    breed: {
        type: String
    },
    gender: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: String,
        required: true
    },
    photo: {
        type: String
    },
    vaccinated: {
        type: Boolean
    },
    friendly: {
        type: Boolean
    },
    microchip: {
        type: Boolean
    }
});

module.exports = mongoose.model('Pet', petSchema);