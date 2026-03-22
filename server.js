const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

let uri = process.env.MONGODB_URI;
if (!uri) {
  try {
    uri = require("./atlas_uri");
  } catch {
    console.error("No MONGODB_URI env and ./atlas_uri not found.");
  }
}
const dbname = "RentFlicks";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const app = express();

app.set("trust proxy", 1);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/assets/img/movies/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed!"), false);
  },
});

app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  if (origin !== "*") res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_only_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

let db;

async function connectToDB() {
  try {
    await client.connect();
    db = client.db(dbname);
    console.log(`Successfully connected to the ${dbname} database`);

    await db
      .collection("AdminUsers")
      .createIndex({ username: 1 }, { unique: true });
    await db
      .collection("RentalUsers")
      .createIndex({ username: 1 }, { unique: true });
    await db
      .collection("hostUsers")
      .createIndex({ username: 1 }, { unique: true });
    await db
      .collection("AdminUsers")
      .createIndex({ adminId: 1 }, { unique: true });
    await db
      .collection("RentalUsers")
      .createIndex({ userId: 1 }, { unique: true });
    await db
      .collection("hostUsers")
      .createIndex({ hostId: 1 }, { unique: true });
    await db
      .collection("Reservations")
      .createIndex({ orderId: 1 }, { unique: true });

    const counterExists = await db
      .collection("counters")
      .findOne({ _id: "userId" });
    if (!counterExists)
      await db
        .collection("counters")
        .insertOne({ _id: "userId", sequence_value: 0 });

    const admincounterExists = await db
      .collection("counters")
      .findOne({ _id: "adminId" });
    if (!admincounterExists)
      await db
        .collection("counters")
        .insertOne({ _id: "adminId", sequence_value: 0 });

    const OrdercounterExists = await db
      .collection("counters")
      .findOne({ _id: "orderId" });
    if (!OrdercounterExists)
      await db
        .collection("counters")
        .insertOne({ _id: "orderId", sequence_value: 0 });

    const hostcounterExists = await db
      .collection("counters")
      .findOne({ _id: "hostId" });
    if (!hostcounterExists)
      await db
        .collection("counters")
        .insertOne({ _id: "hostId", sequence_value: 0 });

    const [a] = await db
      .collection("AdminUsers")
      .aggregate([
        { $group: { _id: null, maxUserIdFromAdmin: { $max: "$adminId" } } },
      ])
      .toArray();
    const [b] = await db
      .collection("RentalUsers")
      .aggregate([
        { $group: { _id: null, maxUserIdFromRental: { $max: "$userId" } } },
      ])
      .toArray();
    const [c] = await db
      .collection("Reservations")
      .aggregate([
        { $group: { _id: null, maxOrderIdFromRental: { $max: "$orderId" } } },
      ])
      .toArray();
    const [d] = await db
      .collection("hostUsers")
      .aggregate([
        { $group: { _id: null, maxHostIdFromHost: { $max: "$hostId" } } },
      ])
      .toArray();
    const adminIdMax = a?.maxUserIdFromAdmin || 0;
    const userIdMax = b?.maxUserIdFromRental || 0;
    const orderIdMax = Math.max(c?.maxOrderIdFromRental || 0);
    const hostIdMax = d?.maxHostIdFromHost || 0;
    await db
      .collection("counters")
      .updateOne(
        { _id: "userId" },
        { $max: { sequence_value: userIdMax } },
        { upsert: true },
      );
    await db
      .collection("counters")
      .updateOne(
        { _id: "adminId" },
        { $max: { sequence_value: adminIdMax } },
        { upsert: true },
      );
    await db
      .collection("counters")
      .updateOne(
        { _id: "orderId" },
        { $max: { sequence_value: orderIdMax } },
        { upsert: true },
      );
    await db
      .collection("counters")
      .updateOne(
        { _id: "hostId" },
        { $max: { sequence_value: hostIdMax } },
        { upsert: true },
      );

    const [finalUserId, finalAdminId, finalOrderId, finalHostId] =
      await Promise.all([
        db.collection("counters").findOne({ _id: "userId" }),
        db.collection("counters").findOne({ _id: "adminId" }),
        db.collection("counters").findOne({ _id: "orderId" }),
        db.collection("counters").findOne({ _id: "hostId" }),
      ]);

    console.log(
      `Synced counters — userId: ${finalUserId?.sequence_value}, adminId: ${finalAdminId?.sequence_value}, orderId: ${finalOrderId?.sequence_value}, hostId: ${finalHostId?.sequence_value}`,
    );

    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error(`MongoDB connection failed to the ${dbname} database`, err);
    process.exitCode = 1;
  }
}

connectToDB();
async function getNextSequence(counterName) {
  try {
    const counter = await db
      .collection("counters")
      .findOneAndUpdate(
        { _id: counterName },
        { $inc: { sequence_value: 1 } },
        { returnDocument: "after", upsert: true },
      );

    console.log(`${counterName} Counter result:`, counter);

    if (
      counter &&
      counter.sequence_value &&
      typeof counter.sequence_value === "number"
    ) {
      console.log(`Returning ${counterName}:`, counter.sequence_value);
      return counter.sequence_value;
    } else {
      console.log("Counter not found or invalid, initializing...");
      await db
        .collection("counters")
        .updateOne(
          { _id: counterName },
          { $set: { sequence_value: 1 } },
          { upsert: true },
        );
      return 1;
    }
  } catch (err) {
    console.error(`Error in getNextSequence for ${counterName}:`, err);
    return 1;
  }
}

app.get("/health", (req, res) => res.status(200).send("OK"));

app.post("/contact_us", async (req, res) => {
  const { name, email, subject, message } = req.body;
  try {
    const data = {
      name,
      email,
      subject,
      message,
    };

    await db.collection("ContactForm").insertOne(data);
    console.log(
      `Successfully inserted comment into to the ${dbname} database from:`,
      name,
    );
    return res.redirect(
      `Home.html?success=${encodeURIComponent("Message Sent")}`,
    );
  } catch (err) {
    console.log(`Insert error to the ${dbname} database`, err);
    return res.redirect(
      `Home.html?error=${encodeURIComponent("Contact Form Failed: " + err.message)}`,
    );
  }
});
app.post("/sign_up", async (req, res) => {
  const { fname, lname, email, username, password, user_type } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  try {
    const existingRental = await db
      .collection("RentalUsers")
      .findOne({ username: username });
    const existingHost = await db
      .collection("hostUsers")
      .findOne({ username: username });
    if (existingRental || existingHost) {
      console.log(`Registration failed: Username '${username}' already exists`);
      return res.redirect(
        `register_form.html?error=${encodeURIComponent("Username already exists. Please choose a different username.")}`,
      );
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    if (user_type === "host") {
      const hostId = await getNextSequence("hostId");
      const data = {
        hostId,
        fname,
        lname,
        email,
        username,
        password: hash,
        user_type: "host",
        address: [],
        payment: [],
        created_at: now,
        updated_at: now,
      };
      await db.collection("hostUsers").insertOne(data);
      console.log(
        `Successfully registered host to the ${dbname} database with hostId:`,
        hostId,
      );
    } else {
      const userId = await getNextSequence("userId");
      const data = {
        userId,
        fname,
        lname,
        email,
        username,
        password: hash,
        user_type: "customer",
        address: [],
        payment: [],
        created_at: now,
        updated_at: now,
      };
      await db.collection("RentalUsers").insertOne(data);
      console.log(
        `Successfully registered customer to the ${dbname} database with userId:`,
        userId,
      );
    }

    return res.redirect("loginform.html");
  } catch (err) {
    console.log(`Insert error to the ${dbname} database`, err);
    console.log("Full error details:", JSON.stringify(err, null, 2));
    if (err.errInfo && err.errInfo.details) {
      console.log(
        "Validation details:",
        JSON.stringify(err.errInfo.details, null, 2),
      );
    }
    return res.redirect(
      `register_form.html?error=${encodeURIComponent("Signup Failed: " + err.message)}`,
    );
  }
});
async function findUser(db, username, hashedPass) {
  const collections = ["AdminUsers", "RentalUsers", "hostUsers"];
  for (const coll of collections) {
    const user = await db
      .collection(coll)
      .findOne({ username, password: hashedPass });
    if (user) {
      return { ...user, _collection: coll };
    }
  }
  return null;
}
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }
    const hashedPass = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");
    const user = await findUser(db, username, hashedPass);

    if (!user) {
      return res.redirect(
        "/loginform.html?error=" +
          encodeURIComponent("Incorrect username or password"),
      );
    }
    const fullName = [user.fname, user.lname].filter(Boolean).join(" ");
    console.log(
      `User Logged In: ${fullName} [user_type=${user.user_type || "Unknown"} from ${user._collection}]`,
    );

    req.session.user = {
      username: user.username,
      fname: user.fname,
      lname: user.lname,
      user_type: user.user_type,
      source: user._collection,
    };
    req.session.user_name = user.username;
    req.session.userData = {
      fname: user.fname,
      lname: user.lname,
      username: user.username,
      user_type: user.user_type,
    };

    if (user.user_type === "admin") {
      return res.redirect("/adminPage.html");
    } else if (user.user_type === "customer") {
      return res.redirect("/movie-reservation.html");
    } else if (user.user_type === "host") {
      return res.redirect("/ownerPage.html");
    } else {
      return res.status(400).send("Unknown user type");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});
function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.redirect("/loginform.html");
  }
  next();
}
app.get("/", (req, res) => {
  res.set({ "Access-control-Allow-Origin": "*" });
  return res.redirect("Home.html");
});
app.get("/logout", requireLogin, (req, res) => {
  const user = req.session.userData;
  if (user) {
    console.log("User Logged Out", user.fname + " " + user.lname);
  } else {
    console.log("Logout failed: User not Failed");
  }
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout failed:", err);
      return res.status(500).send("Logout failed");
    }
    res.clearCookie("connect.sid");
    res.redirect("/Home.html");
  });
});
app.get("/userdetail", requireLogin, (req, res) => {
  const user = req.session.user || req.session.userData;

  if (!user) {
    return res.status(401).json({ error: "Not Authenticated" });
  }

  res.json({
    name: [user.fname, user.lname].filter(Boolean).join(" "),
    username: user.username,
    user_type: user.user_type,
  });
});
app.get("/api/movies", async (req, res) => {
  try {
    const movies = await db.collection("Movies").find({}).toArray();
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch movies" });
  }
});

app.post("/api/reservations", requireLogin, async (req, res) => {
  try {
    const {
      customer_name,
      end_date,
      location,
      address,
      payment,
      movie_ids,
      total_cost,
    } = req.body;
    if (
      !customer_name ||
      !end_date ||
      !location ||
      !address ||
      !payment ||
      !movie_ids
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }
    let movieIds = movie_ids;
    if (typeof movieIds === "string") {
      try {
        movieIds = JSON.parse(movieIds);
      } catch {
        movieIds = [];
      }
    }
    const objectIds = movieIds.map((id) => {
      try {
        if (
          typeof id === "object" &&
          id &&
          (id._bsontype === "ObjectID" || id._bsontype === "ObjectId")
        )
          return id;
        if (typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id))
          return new ObjectId(id);
        return id;
      } catch {
        return id;
      }
    });

    let user_id = null;
    if (req.session && req.session.user_name) {
      const user = await db
        .collection("RentalUsers")
        .findOne({ username: req.session.user_name });
      if (user && user._id) {
        user_id = user._id;
      }
    }
    const movieDocs = await db
      .collection("Movies")
      .find({
        _id: { $in: objectIds },
      })
      .toArray();

    let digital_file = null;

    if (location === "Digital") {
      const firstMovie = movieDocs[0];

      const imgPath = firstMovie?.image_url || firstMovie?.image;
      if (imgPath) {
        digital_file = imgPath.split("/").pop();
      }
    }

    const orderId = await getNextSequence("orderId");
    const data = {
      orderId,
      customer_name,
      end_date,
      order_date: new Date().toISOString().split("T")[0],
      location,
      address,
      payment,
      status: "Renting",
      history_movie_ids: movieIds,
      movie_ids: movieIds,
      ...(user_id && { user_id }),
      ...(total_cost && { total_cost: Number(total_cost) }),
      digital_file: digital_file,
      created_at: new Date().toISOString().replace("T", " ").substring(0, 19),
      updated_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    };
    await db.collection("Reservations").insertOne(data);

    console.log("Updating Movies with IDs:", objectIds);

    const validObjectIds = objectIds.filter(
      (id) => ObjectId.isValid(id) && typeof id === "object",
    );

    console.log("Valid ObjectIds for update:", validObjectIds);

    if (validObjectIds.length > 0) {
      const movies = await db
        .collection("Movies")
        .find({ _id: { $in: validObjectIds } })
        .toArray();
      for (const eq of movies) {
        if (
          typeof eq.quantity_available === "number" &&
          eq.quantity_available > 0
        ) {
          const newQty = eq.quantity_available - 1;
          await db.collection("Movies").updateOne(
            { _id: eq._id },
            {
              $set: {
                quantity_available: newQty,
                availability: newQty > 0,
                unavailable_until: new Date(end_date),
              },
            },
          );
        }
      }
    } else {
      console.log("No valid Movie IDs to update availability.");
    }

    res.json({ message: "Reservation created successfully", ...data });
  } catch (err) {
    console.log(`Insert error to the ${dbname} database`, err);
    res
      .status(500)
      .json({ error: "Failed to create reservation: " + err.message });
  }
});

app.post("/payments", requireLogin, async (req, res) => {
  try {
    const {
      card_number,
      expiration,
      card_type,
      payment_zip_code,
      payment_nickname,
    } = req.body;
    if (
      !card_number ||
      !expiration ||
      !card_type ||
      !payment_zip_code ||
      !payment_nickname
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user?._id) return res.status(404).json({ error: "User not found" });

    const d = new Date(expiration);
    const exp = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
    const entry = {
      payment_customer_name: user.fname + " " + user.lname,
      last4: String(card_number).slice(-4),
      card_type,
      expiration: exp,
      payment_zip_code,
      payment_nickname,
      status: "Active",
      added_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    await db.collection("RentalUsers").updateOne(
      { _id: user._id },
      {
        $push: { payment: entry },
        $set: {
          updated_at: new Date()
            .toISOString()
            .replace("T", " ")
            .substring(0, 19),
        },
      },
    );

    return res.json({ success: true, ...entry });
  } catch (e) {
    console.error("Payment error:", e);
    if (e.errInfo && e.errInfo.details) {
      console.error(
        "Validation details:",
        JSON.stringify(e.errInfo.details, null, 2),
      );
    }
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/addresses", requireLogin, async (req, res) => {
  const { street, city, state, zip_code, phone_number, address_nickname } =
    req.body;
  if (
    !street ||
    !city ||
    !state ||
    !zip_code ||
    !phone_number ||
    !address_nickname
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    let user_id = null;
    if (req.session && req.session.user_name) {
      const user = await db
        .collection("RentalUsers")
        .findOne({ username: req.session.user_name });
      if (user && user._id) {
        user_id = user._id;
      }

      if (user && user._id) {
        const addressEntry = {
          customer_name: user.fname + " " + user.lname,
          address_line1: street,
          city,
          state,
          zip_code,
          phone_number,
          address_nickname,
          added_at: new Date().toISOString().replace("T", " ").substring(0, 19),
        };
        await db.collection("RentalUsers").updateOne(
          { _id: user._id },
          {
            $push: { address: addressEntry },
            $set: {
              updated_at: new Date()
                .toISOString()
                .replace("T", " ")
                .substring(0, 19),
            },
          },
        );
        console.log(
          `Address added to ${dbname} database for userId:`,
          user.fname + " " + user.lname,
        );
        res.json({ message: "Address added successfully", ...addressEntry });
      } else {
        throw new Error("User not found in session.");
      }
    } else {
      throw new Error("User session is not available");
    }
  } catch (err) {
    console.log(`Address Insert error to the ${dbname} database`, err);
    return res.redirect(`movie-reservation.html`);
  }
});

app.get("/download/:orderId", requireLogin, async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      return res.status(401).send("Not logged in.");
    }

    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });

    if (!user) {
      return res.status(404).send("User not found.");
    }

    const orderId = Number(req.params.orderId);

    const reservation = await db
      .collection("Reservations")
      .findOne({ orderId, user_id: user._id });

    if (!reservation) {
      return res.status(404).send("Reservation not found.");
    }

    if (reservation.location !== "Digital" || !reservation.digital_file) {
      return res
        .status(400)
        .send("This reservation does not include a digital download.");
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const end = new Date(reservation.end_date);
    end.setHours(23, 59, 59, 999);

    if (now > end) {
      return res.status(403).send("This download has expired.");
    }

    const filePath = path.join(
      __dirname,
      "public",
      "assets",
      "img",
      "movies",
      reservation.digital_file,
    );

    return res.download(filePath, (err) => {
      if (err) {
        console.error("Download error:", err);
        return res.status(404).send("File not found.");
      }
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send("Server error.");
  }
});

app.post("/api/return", requireLogin, async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }
    const { movieId } = req.body;
    if (!movieId) {
      return res
        .status(400)
        .json({ success: false, error: "No movie ID provided" });
    }
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const reservations = await db
      .collection("Reservations")
      .find({ user_id: user._id })
      .toArray();
    let reservation = null;
    let matchedIdType = null;
    for (const resv of reservations) {
      if (Array.isArray(resv.movie_ids)) {
        for (const id of resv.movie_ids) {
          if (
            (typeof id === "object" &&
              id &&
              id._bsontype &&
              id.toString() === movieId) ||
            (typeof id === "string" && id === movieId)
          ) {
            reservation = resv;
            matchedIdType = typeof id;
            break;
          }
        }
      }
      if (reservation) break;
    }
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "Reservation not found for this movie",
      });
    }

    let updatedMovieIds = reservation.movie_ids.filter((id) => {
      if (typeof id === "object" && id && id._bsontype) {
        return id.toString() !== movieId;
      }
      return id !== movieId;
    });
    if (updatedMovieIds.length === 0) {
      await db.collection("Reservations").updateOne(
        { _id: reservation._id },
        {
          $set: {
            movie_ids: [],
            status: "Complete",
            updated_at: new Date()
              .toISOString()
              .replace("T", " ")
              .substring(0, 19),
          },
        },
      );
    } else {
      await db.collection("Reservations").updateOne(
        { _id: reservation._id },
        {
          $set: {
            movie_ids: updatedMovieIds,
            updated_at: new Date()
              .toISOString()
              .replace("T", " ")
              .substring(0, 19),
          },
        },
      );
    }

    let eqId = ObjectId.isValid(movieId) ? new ObjectId(movieId) : movieId;
    const movie = await db.collection("Movies").findOne({ _id: eqId });
    if (movie) {
      const newQty = (movie.quantity_available || 0) + 1;
      await db.collection("Movies").updateOne(
        { _id: eqId },
        {
          $set: {
            quantity_available: newQty,
            availability: newQty > 0,
          },
          $unset: { unavailable_until: "" },
        },
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Return error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error: " + err.message });
  }
});

setInterval(async () => {
  try {
    const now = new Date();
    await db.collection("Movies").updateMany(
      {
        unavailable_until: { $lte: now },
        availability: false,
        quantity_available: { $gt: 0 },
      },
      { $set: { availability: true }, $unset: { unavailable_until: "" } },
    );
  } catch (err) {
    console.error("Error updating movie availability:", err);
  }
}, 60 * 1000);

app.get("/api/userinfo", async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      console.log("User not found or not logged in.");
      return res.json({ name: "Customer" });
    }
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (user) {
      return res.json({ name: user.fname + " " + user.lname });
    } else {
      console.log(
        "User not found in database for username:",
        req.session.user_name,
      );
      return res.json({ name: req.session.user_name });
    }
  } catch (err) {
    console.log("User not found or error occurred.");
    return res.json({ name: "Customer" });
  }
});
app.get("/api/myrentals", async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const reservations = await db
      .collection("Reservations")
      .find({ user_id: user._id })
      .toArray();
    const movieIdSet = new Set();
    reservations.forEach((resv) => {
      if (Array.isArray(resv.movie_ids)) {
        resv.movie_ids.forEach((id) => {
          if (typeof id === "object" && id && id._bsontype) {
            movieIdSet.add(id.toString());
          } else if (typeof id === "string") {
            movieIdSet.add(id);
          }
        });
      }
    });
    if (movieIdSet.size === 0) {
      return res.json([]);
    }
    const movieIds = Array.from(movieIdSet)
      .map((id) => {
        try {
          return ObjectId.isValid(id) ? new ObjectId(id) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const movies = await db
      .collection("Movies")
      .find({ _id: { $in: movieIds } })
      .toArray();
    const result = movies.map((eq) => ({
      id: eq._id,
      name: eq.name || eq.movieName || "Movies",
      description: eq.description || "",
      image: eq.image || "",
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user rentals" });
  }
});
app.get("/api/myreservations", async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) return res.status(404).json({ error: "User not found" });

    const reservations = await db
      .collection("Reservations")
      .find({ user_id: user._id })
      .toArray();
    if (reservations.length === 0) return res.json([]);

    const allMovieIds = reservations.flatMap((r) => r.history_movie_ids || []);
    const uniqueIds = [...new Set(allMovieIds.map((id) => id.toString()))];
    const objectIds = uniqueIds
      .map((id) => (ObjectId.isValid(id) ? new ObjectId(id) : null))
      .filter(Boolean);

    const movieMap = {};
    const movieDocs = await db
      .collection("Movies")
      .find({ _id: { $in: objectIds } })
      .toArray();
    movieDocs.forEach((eq) => {
      movieMap[eq._id.toString()] = eq.name || eq.movieName || "Movies";
    });

    const result = reservations.map((r) => ({
      order_id: r.orderId || "N/A",
      order_date: r.order_date,
      end_date: r.end_date,
      status: r.status || "Renting",
      location: r.location || "",
      total_cost: r.total_cost || 0,
      items: (r.history_movie_ids || []).map(
        (id) => movieMap[id.toString()] || "Unknown",
      ),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});
app.get("/api/mypayments", async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) return res.status(404).json({ error: "User not found" });

    const payments = user.payment || [];

    const result = payments.map((p, index) => ({
      customer_name: p.customer_name || "N/A",
      last4: p.last4,
      expiration: p.expiration,
      status: p.status || "Active",
      card_type: p.card_type || "N/A",
      payment_nickname: p.payment_nickname || "N/A",
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Payment Methods" });
  }
});
app.get("/api/myaddress", async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) return res.status(404).json({ error: "User not found" });

    const addresses = user.address || [];

    const result = addresses.map((p, index) => ({
      customer_name: p.customer_name || "N/A",
      address_line1: p.address_line1,
      city: p.city,
      state: p.state,
      zip_code: p.zip_code,
      phone_number: p.phone_number || "N/A",
      address_nickname: p.address_nickname || "Saved Address",
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Address Book" });
  }
});
app.delete("/api/delete-payment", requireLogin, async (req, res) => {
  const { last4, expiration } = req.body;
  if (!req.session || !req.session.user_name) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) return res.status(404).json({ error: "User not found" });

    const result = await db
      .collection("RentalUsers")
      .updateOne(
        { _id: user._id },
        { $pull: { payment: { last4, expiration } } },
      );
    if (result.modifiedCount > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Payment not found" });
    }
  } catch (err) {
    console.error("Delete payment error", err);
    res.status(500).json({ error: "Failed to remove Payment Method" });
  }
});

app.delete("/api/delete-address", async (req, res) => {
  const { address_nickname, address_line1 } = req.body;
  if (!req.session || !req.session.user_name) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) return res.status(404).json({ error: "User not found" });

    const result = await db
      .collection("RentalUsers")
      .updateOne(
        { _id: user._id },
        { $pull: { address: { address_nickname, address_line1 } } },
      );
    if (result.modifiedCount > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Address not found" });
    }
  } catch (err) {
    console.error("Delete address error", err);
    res.status(500).json({ error: "Failed to remove Address" });
  }
});

app.post("/api/movie", upload.single("image"), async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      rental_rate_per_day,
      quantity_available,
    } = req.body;

    if (!name || !category || !rental_rate_per_day || !quantity_available) {
      return res.status(400).json({
        error: "Name, category, rental rate, and quantity are required",
      });
    }

    let imagePath = "";
    if (req.file) {
      imagePath = "assets/img/movies/" + req.file.filename;
    }

    const movieData = {
      name: name.trim(),
      category: category.trim(),
      description: description ? description.trim() : "",
      rental_rate_per_day: parseFloat(rental_rate_per_day),
      quantity_available: parseInt(quantity_available),
      availability: parseInt(quantity_available) > 0,
      image_url: imagePath,
      created_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    const result = await db.collection("Movies").insertOne(movieData);
    res.json({
      message: "Movie added successfully",
      movie: { _id: result.insertedId, ...movieData },
    });
  } catch (err) {
    console.error("Add movie error:", err);
    res.status(500).json({ error: "Failed to add movie" });
  }
});

app.delete("/api/movie/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid movie ID" });
    }

    const result = await db
      .collection("Movies")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount > 0) {
      res.json({ success: true, message: "Movie deleted successfully" });
    } else {
      res.json({ success: false, error: "Movie not found" });
    }
  } catch (err) {
    console.error("Delete movie error:", err);
    res.status(500).json({ error: "Failed to delete movie" });
  }
});

app.put(
  "/api/movie/:id",
  requireLogin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        category,
        description,
        rental_rate_per_day,
        quantity_available,
      } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid movie ID" });
      }

      if (
        !name ||
        !category ||
        !rental_rate_per_day ||
        quantity_available === undefined
      ) {
        return res.status(400).json({
          error: "Name, category, rental rate, and quantity are required",
        });
      }

      const updateData = {
        name: name.trim(),
        category: category.trim(),
        description: description ? description.trim() : "",
        rental_rate_per_day: parseFloat(rental_rate_per_day),
        quantity_available: parseInt(quantity_available),
        availability: parseInt(quantity_available) > 0,
        updated_at: new Date().toISOString().replace("T", " ").substring(0, 19),
      };

      if (req.file) {
        updateData.image_url = "assets/img/movies/" + req.file.filename;
      }

      const result = await db
        .collection("Movies")
        .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

      if (result.modifiedCount > 0) {
        res.json({ success: true, message: "Movie updated successfully" });
      } else {
        res.json({
          success: false,
          error: "Movie not found or no changes made",
        });
      }
    } catch (err) {
      console.error("Update Movie error:", err);
      res.status(500).json({ error: "Failed to update Movie" });
    }
  },
);
