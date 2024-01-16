// config.js
const mongoose = require("mongoose");

const connect = mongoose.connect("mongodb://127.0.0.1:27017/Login-tut", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Check database connected or not
connect
  .then(() => {
    console.log("Database Connected Successfully");
  })
  .catch(() => {
    console.log("Database cannot be Connected");
  });

// Create Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const User = mongoose.model("User", userSchema);

// Export the User model
module.exports = User;
