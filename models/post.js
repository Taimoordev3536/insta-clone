const mongoose = require("mongoose");

let postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  date: {
    type: Date,
    default: Date.now,
  },
  image: String,
  content: String,
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  comments: [{
    text: String,
    author: String,
    date: { type: Date, default: Date.now }
}],
});

module.exports = mongoose.model("Post", postSchema);
