const express = require("express");
const app = express();

const multer = require('multer');
const path = require("path");
const userModel = require("./models/user");
const postModel = require("./models/post");
const Story = require('./models/story');
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const port = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));


app.get("/", (req, res) => {
  res.render("index");
});
app.get("/free", (req, res) => {
  res.render("free");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get('/allprofiles', isLoggedIn, async (req, res) => {
  let loggedInUser = await userModel.findOne({ _id: req.user.userid });
  let Users = await userModel.find({ _id: { $ne: req.user.userid } }); // Exclude logged-in user
  res.render('allprofiles', { Users, loggedInUser });
});


app.get("/profile", isLoggedIn, async (req, res) => {
  let loggedInUser = await userModel.findOne({ _id: req.user.userid });
  let user = await userModel.findOne({ _id: req.user.userid }).populate("posts");
  res.render("profile", { user,loggedInUser });
});


app.get("/profile/:id", isLoggedIn, async (req, res) => {
  let loggedInUser = await userModel.findOne({ _id: req.user.userid });
  let user = await userModel.findOne({ _id: req.params.id }).populate("posts");
  res.render("profile", { user,loggedInUser });
});
  

//like functionality
app.get("/like/:id", isLoggedIn, async (req, res) => {
  try {
    let post = await postModel.findOne({ _id: req.params.id });
    
    if (post.likes.includes(req.user.userid)) {
      // If already liked, unlike it
      post.likes = post.likes.filter(userId => userId.toString() !== req.user.userid.toString());
    } else {
      // Otherwise, like the post
      post.likes.push(req.user.userid);
    }
    
    await post.save();
    res.redirect("/allpost"); // Redirects to the all posts page
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content });
  res.redirect("/profile");
});

app.get("/allpost", isLoggedIn, async (req, res) => {
  try {
    let loggedInUser = await userModel.findOne({ _id: req.user.userid }).populate("following");
    
    const followedUserIds = loggedInUser.following.map(followedUser => followedUser._id);
    // console.log("Followed User IDs:", followedUserIds);

    const stories = await Story.find({
      user: { $in: [...followedUserIds, loggedInUser._id] }
    }).populate('user');

    // console.log("Fetched Stories:", stories);

    const suggestions = await userModel.find({
      _id: { $nin: [...followedUserIds, loggedInUser._id] }
    });

    let Users = await userModel.find({ _id: { $ne: loggedInUser._id } });

    const allPosts = await postModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $sort: { date: -1 } }
    ]);
    res.render('allpost', { allPosts, loggedInUser, Users, suggestions, stories });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/stories'); // specify the path to save uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Route to handle story upload
app.post('/story', isLoggedIn, upload.single('story'), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  try {
    const newStory = new Story({
      user: user._id, // Ensure this is correctly set
      image: req.file && req.file.mimetype.startsWith('image/') ? '/uploads/stories/' + req.file.filename : null,
      video: req.file && req.file.mimetype.startsWith('video/') ? '/uploads/stories/' + req.file.filename : null,
    });
    await newStory.save();
    
    res.redirect('/allpost');  // Redirect to all posts page after uploading the story
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});


//watch story
app.get('/story/:id', isLoggedIn, async (req, res) => {
  const story = await Story.findOne({ _id: req.params.id }).populate('user');
  
  if (!story) {
    return res.status(404).send('Story not found');
  }

  res.render('story', { story });
});


app.post("/search", isLoggedIn, async (req, res) => {
  try {
    let searchacc = req.body.searchacc;

    // Perform a case-insensitive search for the username
    let users = await userModel.find({
      username: { $regex: searchacc, $options: 'i' }  // Case-insensitive search
    }).populate("posts");

    if (users.length > 0) {
      res.render("searchuser", { user: users[0] });
    } else {
      res.render("searchuser", { user: null });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});



app.get("/newpost",(req,res)=>{
  res.render('createPost');
});
app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content, image } = req.body;
  let post = await postModel.create({
    user: user._id,
    content,
    image,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});
app.post("/comment/:id", isLoggedIn, async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ email: req.user.email });
    const loggeduserName = loggedInUser.username;
    
    const post = await postModel.findById(req.params.id);
    post.comments.push({
      text: req.body.comment,
      author: loggeduserName,
      date: new Date(),
    });
    await post.save();
    res.redirect("/allpost");
  } catch (err) {
    res.status(500).send(err);
  }
});

// Follow a user
app.post('/follow/:id', isLoggedIn, async (req, res) => {
  let userToFollow = await userModel.findById(req.params.id);
  let currentUser = await userModel.findById(req.user.userid);

  if (!userToFollow.followers.includes(req.user.userid)) {
    userToFollow.followers.push(req.user.userid);
    currentUser.following.push(req.params.id);
  }

  await userToFollow.save();
  await currentUser.save();

  res.redirect('/profile/' + req.params.id);
});

// Unfollow a user
app.post('/unfollow/:id', isLoggedIn, async (req, res) => {
  let userToUnfollow = await userModel.findById(req.params.id);
  let currentUser = await userModel.findById(req.user.userid);

  userToUnfollow.followers.pull(req.user.userid);
  currentUser.following.pull(req.params.id);

  await userToUnfollow.save();
  await currentUser.save();

  res.redirect('/profile/' + req.params.id);
});



app.post("/login", async (req, res) => {
  let { email, password } = req.body;

  let user = await userModel.findOne({ email });
  if (!user) return res.status(500).send("Something went Wrong");

  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, userid: user._id }, "shhhhhhhhh");
      res.cookie("token", token);
      res.redirect("/allprofiles");
    } else {
      res.redirect("/login");
    }
  });
});

app.post("/register", async (req, res) => {
  let { email, image, name, username, age, password } = req.body;
  let user = await userModel.findOne({ email });
  if (user) return res.status(500).send("User is already registered with this email");

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      if (err) return res.status(500).send("Error in hashing");
      let newUser = await userModel.create({
        email,
        name,
        username,
        age,
        image,
        password: hash,
      });

      let token = jwt.sign({ email: email, userid: newUser._id }, "shhhhhhhhh");
      res.cookie("token", token);
      res.redirect("login");
    });
  });
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("/login");
});

function isLoggedIn(req, res, next) {
  if (!req.cookies.token) {
    res.redirect("/login");
  } else {
    let data = jwt.verify(req.cookies.token, "shhhhhhhhh");
    req.user = data;
    next();
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
