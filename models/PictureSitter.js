const mongoose = require('mongoose');

const pictureSitterSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    filename: {
        type: String
    },
    url: {
        type: String
    }
});

module.exports = mongoose.model('PictureSitter', pictureSitterSchema);