const mongoose = require('mongoose');

const sitterSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Sitter', sitterSchema);