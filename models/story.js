const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
  image: {
    type: String,
    required: true
  },
  video: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Story expires after 24 hours (86400 seconds)
  }
});

module.exports =mongoose.model('Story', storySchema);

