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
    }
});

module.exports = mongoose.model('Sitter', sitterSchema);