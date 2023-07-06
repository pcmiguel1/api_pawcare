const mongoose = require('mongoose');

const messagesSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    sender: {
        type: Object,
        required: true
    },
    receiver: {
        type: Object,
        required: true
    },
    createdat: {
        type: Date,
        default: Date.now
    }
    
});

module.exports = mongoose.model('Messages', messagesSchema);