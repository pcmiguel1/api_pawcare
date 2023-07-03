const mongoose = require('mongoose');

const sitterSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    headline: {
        type: String
    },
    description: {
        type: String
    },
    lat: {
        type: String
    },
    long: {
        type: String
    },
    phone: {
        type: String
    },
    sortcode: {
        type: String
    },
    accountnumber: {
        type: String
    },
    petwalking: {
        type: Boolean,
        default: false
    },
    ratewalking: {
        type: String,
        default: 0
    },
    ratewalkingaddpet: {
        type: String, 
        default: 0
    },
    petboarding: {
        type: Boolean,
        default: false
    },
    ratepetboarding: {
        type: String,
        default: 0
    },
    ratepetboardingaddpet: {
        type: String, 
        default: 0
    },
    housesitting: {
        type: Boolean,
        default: false
    },
    ratehousesitting: {
        type: String,
        default: 0
    },
    ratehousesittingaddpet: {
        type: String, 
        default: 0
    },
    training: {
        type: Boolean,
        default: false
    },
    ratetraining: {
        type: String,
        default: 0
    },
    ratetrainingaddpet: {
        type: String, 
        default: 0
    },
    grooming: {
        type: Boolean,
        default: false
    },
    rategrooming: {
        type: String,
        default: 0
    },
    rategroomingaddpet: {
        type: String, 
        default: 0
    },
    pickupdropoff: {
        type: Boolean,
        default: false
    },
    oralmedications: {
        type: Boolean,
        default: false
    },
    injectmedications: {
        type: Boolean,
        default: false
    }
    
});

module.exports = mongoose.model('Sitter', sitterSchema);