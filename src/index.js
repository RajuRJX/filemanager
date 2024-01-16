const express = require("express");
const session = require("express-session");
const flash = require("express-flash");
const path = require("path");
const collection = require("../src/config");
const bcrypt = require("bcrypt");
const multer = require("multer");
const fs = require("fs");
const winston = require("winston");

// Create 'uploads' directory if it doesn't exist
const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}

const app = express();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // The user's folder will be created if it doesn't exist
    const userFolderPath = path.join(
      __dirname,
      "uploads",
      req.session.username
    );
    if (!fs.existsSync(userFolderPath)) {
      fs.mkdirSync(userFolderPath);
    }
    cb(null, userFolderPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Create a logger instance
const logger = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logfile.log" }), // This will log to a file named 'logfile.log'
  ],
});

app.use(
  session({ secret: "your-secret-key", resave: true, saveUninitialized: true })
);
app.use(flash());

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

// Middleware to check if the user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.session.loggedIn) {
    return next();
  }
  res.redirect("/");
};

app.get("/", (req, res) => {
  res.render("login", {
    message: req.flash("signupSuccess"),
    error: req.flash("error"),
  });
});

app.get("/signup", (req, res) => {
  res.render("signup", { error: req.flash("error") });
});

app.post("/signup", async (req, res) => {
  const data = {
    name: req.body.username,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
  };

  try {
    const existingUser = await collection.findOne({ name: data.name });

    if (existingUser) {
      req.flash(
        "error",
        "User already exists. Please choose a different username."
      );
      res.redirect("/signup");
      logger.info(`User already exists. User: ${data.name}`);
    } else {
      if (data.password !== data.confirmPassword) {
        req.flash("error", "Passwords do not match. Please re-enter.");
        res.redirect("/signup");
        logger.info(`Passwords do not match for user: ${data.name}`);
      } else {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        data.password = hashedPassword;

        const userdata = await collection.create({
          name: data.name,
          password: data.password,
        });

        req.flash(
          "signupSuccess",
          "Successfully signed up! Login after signup."
        );
        res.redirect("/");
        logger.info(`User signed up: ${data.name}`);
      }
    }
  } catch (error) {
    console.error("Error during signup:", error);
    req.flash("error", "Error during signup");
    res.redirect("/signup");
    logger.error(`Error during signup: ${error.message}`);
  }
});

app.post("/login", async (req, res) => {
  try {
    const check = await collection.findOne({ name: req.body.username });

    if (!check) {
      req.flash("error", "User name cannot be found. Please sign up.");
      res.redirect("/");
    } else {
      const isPasswordMatch = await bcrypt.compare(
        req.body.password,
        check.password
      );

      if (!isPasswordMatch) {
        req.flash("error", "Wrong Password");
        res.redirect("/");
      } else {
        req.session.loggedIn = true;
        req.session.username = check.name;

        // Redirect to the home page
        res.redirect("/home");
      }
    }
  } catch (error) {
    console.error("Error during login:", error);
    req.flash("error", "Error during login");
    res.redirect("/");
  }
});

// Route to render the home page
app.get("/home", isLoggedIn, (req, res) => {
  // Fetch the list of files for the user
  const userFolderPath = path.join(__dirname, "uploads", req.session.username);
  let files = [];
  if (fs.existsSync(userFolderPath)) {
    files = fs.readdirSync(userFolderPath);
  }

  res.render("home", { username: req.session.username, files: files });
});

app.post("/upload", isLoggedIn, upload.single("file"), (req, res) => {
  try {
    // File upload successful
    req.flash("success", "File uploaded successfully!");
    res.redirect("/home");
    logger.info(`File uploaded by user: ${req.session.username}`);
  } catch (error) {
    console.error("Error during file upload:", error);
    req.flash("error", "Error during file upload");
    res.redirect("/home");
    logger.error(`Error during file upload: ${error.message}`);
  }
});
app.get("/home", isLoggedIn, async (req, res) => {
  // Fetch the list of files for the user
  const userFolderPath = path.join(__dirname, "uploads", req.session.username);
  let files = [];
  if (fs.existsSync(userFolderPath)) {
    files = fs.readdirSync(userFolderPath);
  }

  res.render("home", { username: req.session.username, files: files });
});

const { promisify } = require("util");

// Promisify the fs.readFile function
const readFileAsync = promisify(fs.readFile.bind(fs));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Route to display the content of a file
// Route to display the content of a file
app.get("/view/:filename", isLoggedIn, (req, res) => {
  const userFolderPath = path.join(__dirname, "uploads", req.session.username);
  const filePath = path.join(userFolderPath, req.params.filename);

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    // Display PDF using <embed> tag
    res.send(`
        <embed src="/uploads/${req.session.username}/${req.params.filename}" type="application/pdf" width="100%" height="600px"/>
      `);
  } else {
    res.status(404).send("File not found");
  }
});
// Add this route to handle file search
app.get("/search", isLoggedIn, (req, res) => {
  const userFolderPath = path.join(__dirname, "uploads", req.session.username);
  const keyword = req.query.keyword.toLowerCase(); // Get the search keyword

  let files = [];
  if (fs.existsSync(userFolderPath)) {
    files = fs.readdirSync(userFolderPath);

    // Filter files based on the search keyword
    files = files.filter((file) => file.toLowerCase().includes(keyword));
  }

  res.render("home", { username: req.session.username, files: files });
});

const port = 5500; // Change this to a different port number
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
