const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/miniproject", {
});

mongoose.set('debug', true);

let userSchema = new mongoose.Schema({
  password: String,
  email: String,
  name: String,
  username: String,
  image: String,
  age: String,
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post"
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }]
});

module.exports = mongoose.model("User", userSchema);
