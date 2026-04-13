require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
// MongoDB connection URI - first try environment variable, then fallback to atlas_uri.js file, and log an error if neither is available
let uri = process.env.MONGODB_URI;
if (!uri) {
  try {
    uri = require("./atlas_uri");
  } catch {
    console.error("No MONGODB_URI env and ./atlas_uri not found.");
  }
}
// MongoDB database name
const dbname = "DriveShare";
// Create a new MongoClient with the provided URI and server API version, enabling strict mode and deprecation error handling for better compatibility and debugging. This client will be used to connect to the MongoDB database and perform operations throughout the application.
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
// Configure multer for file uploads with storage settings, file size limits, and file type filtering to allow only image uploads. Uploaded files will be stored in the specified directory with unique filenames to prevent conflicts.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/assets/img/vehicles/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});
// Configure multer for file uploads with storage settings, file size limits, and file type filtering to allow only image uploads. Uploaded files will be stored in the specified directory with unique filenames to prevent conflicts.
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed!"), false);
  },
});
// CORS configuration to allow requests from specified origins and handle preflight requests
app.use((req, res, next) => {
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.origin;
  let originHeader = "*";
  if (allowedOrigins.length === 0) {
    originHeader = "*";
  } else if (allowedOrigins.includes(requestOrigin)) {
    originHeader = requestOrigin;
  } else {
    originHeader = allowedOrigins[0];
  }
  res.header("Access-Control-Allow-Origin", originHeader);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  if (originHeader !== "*")
    res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
// Configure session management with secure cookies in production and appropriate settings for development
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
// This function connects to the MongoDB database, sets up necessary indexes, initializes counters for unique ID generation, and starts the Express server. It also includes error handling to log any connection issues and exit the process if the connection fails.
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
      .collection("HostUsers")
      .createIndex({ username: 1 }, { unique: true });
    await db
      .collection("AdminUsers")
      .createIndex({ adminId: 1 }, { unique: true });
    await db
      .collection("RentalUsers")
      .createIndex({ userId: 1 }, { unique: true });
    await db
      .collection("HostUsers")
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
      .collection("HostUsers")
      .aggregate([
        { $group: { _id: null, maxHostIdFromHost: { $max: "$hostId" } } },
      ])
      .toArray();
    await db
      .collection("Reviews")
      .createIndex({ reservation_id: 1 }, { unique: true });
    await db.collection("Reviews").createIndex({ vehicle_id: 1 });
    await db.collection("Reviews").createIndex({ user_id: 1, created_at: -1 });
    const adminIdMax = a?.maxUserIdFromAdmin || 0;
    const userIdMax = b?.maxUserIdFromRental || 0;
    const orderIdMax = Math.max(c?.maxOrderIdFromRental || 0);
    const hostIdMax = d?.maxHostIdFromHost || 0;
    await db
      .collection("counters")
      .updateOne(
        { _id: "userId" },
        { $set: { sequence_value: userIdMax } },
        { upsert: true },
      );
    await db
      .collection("counters")
      .updateOne(
        { _id: "adminId" },
        { $set: { sequence_value: adminIdMax } },
        { upsert: true },
      );
    await db
      .collection("counters")
      .updateOne(
        { _id: "orderId" },
        { $set: { sequence_value: orderIdMax } },
        { upsert: true },
      );
    await db
      .collection("counters")
      .updateOne(
        { _id: "hostId" },
        { $set: { sequence_value: hostIdMax } },
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
// this is the singleton pattern for managing user sessions it connect to the DB first and then creates a single instance of the SessionManager that can be used throughout the app to track active user sessions. The SessionManager provides methods to add, remove, and check active sessions, and logs session events for debugging purposes.
const SessionManagerSingleton = (() => {
  let instance = null; // Variable to hold the single instance of the SessionManager
  function createInstance() {
    return {
      activeSessions: new Map(),
      addSession(username, sessionId) {
        // Method to add a new user session
        this.activeSessions.set(username, sessionId); // Store the session
        console.log(`[SessionManager] Session started: ${username}`); // Log session
      },
      removeSession(username) {
        this.activeSessions.delete(username);
        console.log(`[SessionManager] Session ended: ${username}`);
      },
      isActive(username) {
        // Method to check if a session for a given user is active
        return this.activeSessions.has(username);
      },
    };
  }
  return {
    getInstance() {
      // Method to get the singleton instance of the SessionManager
      if (!instance) {
        instance = createInstance();
        console.log("[SessionManager] Singleton instance created.");
      }
      return instance;
    },
  };
})();
const sessionManager = SessionManagerSingleton.getInstance();
// Utility function to get the next sequence value for a given counter name
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

// Normalize a vehicle id field that may be a single ObjectId or an array
function toIdArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}
function normalizeObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function getVehicleLabel(vehicle) {
  return (
    [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") ||
    vehicle?.name ||
    "Unknown Vehicle"
  );
}
// Get average rating and review count for a list of vehicle IDs
async function getReviewStatsByVehicleIds(vehicleIds = []) {
  const ids = vehicleIds.map(normalizeObjectId).filter(Boolean);
  if (!ids.length) return {};

  const rows = await db
    .collection("Reviews")
    .aggregate([
      { $match: { vehicle_id: { $in: ids } } },
      {
        $group: {
          _id: "$vehicle_id",
          avg_rating: { $avg: "$rating" },
          review_count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const stats = {};
  rows.forEach((row) => {
    stats[row._id.toString()] = {
      avg_rating: Number((row.avg_rating || 0).toFixed(1)),
      review_count: row.review_count || 0,
    };
  });

  return stats;
}
// Serialize a review document, converting ObjectIds to strings and ensuring all expected fields are present
function serializeReview(doc) {
  return {
    ...doc,
    _id: doc._id?.toString?.() || "",
    reservation_id: doc.reservation_id?.toString?.() || "",
    vehicle_id: doc.vehicle_id?.toString?.() || "",
    user_id: doc.user_id?.toString?.() || "",
  };
}
app.get("/health", (req, res) => res.status(200).send("OK"));
// ── MVC: Home Page Endpoint ──────────────────────────────
// Model: Static HTML/CSS/JS files in the public directory
// View: Home.html as the landing page for all users
// Controller: This endpoint serves as the root URL and redirects to the Home.html page, which is the main entry point for users to navigate to login, registration, or explore the site.
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
// ── MVC: Sign-Up Endpoint ──────────────────────────────
// Model: MongoDB collections (AdminUsers, RentalUsers, HostUsers) with unique username constraints
// View: register_form.html that submits to this endpoint
// Controller: This endpoint handles user registration by validating input, checking for existing usernames across all user collections, hashing the password, and inserting the new user into the appropriate collection based on user type. It also logs registration events and handles errors gracefully by redirecting back to the registration form with appropriate messages.
app.post("/sign_up", async (req, res) => {
  const {
    fname,
    lname,
    email,
    username,
    password,
    user_type,
    security1,
    answer1,
    security2,
    answer2,
    security3,
    answer3,
  } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  try {
    const existingRental = await db
      .collection("RentalUsers")
      .findOne({ username: username });
    const existingHost = await db
      .collection("HostUsers")
      .findOne({ username: username });
    if (existingRental || existingHost) {
      console.log(`Registration failed: Username '${username}' already exists`);
      return res.redirect(
        `register_form.html?error=${encodeURIComponent("Username already exists. Please choose a different username.")}`,
      );
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    const security_questions = [
      {
        question: security1,
        answer: crypto
          .createHash("sha256")
          .update((answer1 || "").trim().toLowerCase())
          .digest("hex"),
      },
      {
        question: security2,
        answer: crypto
          .createHash("sha256")
          .update((answer2 || "").trim().toLowerCase())
          .digest("hex"),
      },
      {
        question: security3,
        answer: crypto
          .createHash("sha256")
          .update((answer3 || "").trim().toLowerCase())
          .digest("hex"),
      },
    ];

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
        security_questions,
        address: [],
        payment: [],
        created_at: now,
        updated_at: now,
      };
      await db.collection("HostUsers").insertOne(data);
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
        security_questions,
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
// ── Chain of Responsibility: Password Recovery ──────────────────────────────
// Each handler validates one concern. On failure it redirects and stops.
// On success it calls this.next(ctx) to pass control to the next handler.

class PasswordResetHandler {
  setNext(handler) {
    this._next = handler;
    return handler; // enables fluent chaining
  }
  async handle(ctx) {
    if (this._next) return this._next.handle(ctx);
  }
}

// Handler 1 – required fields present
class RequiredFieldsHandler extends PasswordResetHandler {
  async handle(ctx) {
    const { username, new_password, confirm_password, res } = ctx;
    if (!username || !new_password || !confirm_password) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("All fields are required.")}`,
      );
    }
    return super.handle(ctx);
  }
}

// Handler 2 – passwords match
class PasswordMatchHandler extends PasswordResetHandler {
  async handle(ctx) {
    const { new_password, confirm_password, res } = ctx;
    if (new_password !== confirm_password) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("Passwords do not match.")}`,
      );
    }
    return super.handle(ctx);
  }
}

// Handler 3 – password meets strength rules
class PasswordStrengthHandler extends PasswordResetHandler {
  async handle(ctx) {
    const { new_password, res } = ctx;
    if (new_password.length < 8) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("Password must be at least 8 characters.")}`,
      );
    }
    if (!/[A-Z]/.test(new_password)) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("Password must contain at least one uppercase letter.")}`,
      );
    }
    if (!/[a-z]/.test(new_password)) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("Password must contain at least one lowercase letter.")}`,
      );
    }
    if (!/[0-9]/.test(new_password)) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("Password must contain at least one number.")}`,
      );
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(new_password)) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("Password must contain at least one special character.")}`,
      );
    }
    return super.handle(ctx);
  }
}

// Handler 4 – user exists in the database
class UserLookupHandler extends PasswordResetHandler {
  async handle(ctx) {
    const { username, res } = ctx;
    const collections = ["RentalUsers", "HostUsers"];
    for (const coll of collections) {
      const found = await db.collection(coll).findOne({ username });
      if (found) {
        ctx.user = found;
        ctx.collection = coll;
        return super.handle(ctx);
      }
    }
    return res.redirect(
      `passwordResetForm.html?error=${encodeURIComponent("No account found with that username.")}`,
    );
  }
}

// Handler 5 – security questions match
class SecurityQuestionsHandler extends PasswordResetHandler {
  async handle(ctx) {
    const {
      security1,
      answer1,
      security2,
      answer2,
      security3,
      answer3,
      user,
      res,
    } = ctx;
    if (user.security_questions && user.security_questions.length > 0) {
      const submitted = [
        {
          question: security1,
          answer: crypto
            .createHash("sha256")
            .update((answer1 || "").trim().toLowerCase())
            .digest("hex"),
        },
        {
          question: security2,
          answer: crypto
            .createHash("sha256")
            .update((answer2 || "").trim().toLowerCase())
            .digest("hex"),
        },
        {
          question: security3,
          answer: crypto
            .createHash("sha256")
            .update((answer3 || "").trim().toLowerCase())
            .digest("hex"),
        },
      ];
      const allMatch = user.security_questions.every((sq, i) => {
        return (
          submitted[i] &&
          submitted[i].question === sq.question &&
          submitted[i].answer === sq.answer
        );
      });
      if (!allMatch) {
        return res.redirect(
          `passwordResetForm.html?error=${encodeURIComponent("Security answers do not match our records.")}`,
        );
      }
    }
    return super.handle(ctx);
  }
}

// Handler 6 – persist the new password
class PasswordUpdateHandler extends PasswordResetHandler {
  async handle(ctx) {
    const { username, new_password, collection, res } = ctx;
    const hash = crypto.createHash("sha256").update(new_password).digest("hex");
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db
      .collection(collection)
      .updateOne({ username }, { $set: { password: hash, updated_at: now } });
    console.log(`Password reset successful for user: ${username}`);
    return res.redirect(
      `loginform.html?success=${encodeURIComponent("Password reset successfully. Please sign in.")}`,
    );
  }
}

// Wire the chain once at startup
const passwordResetChain = new RequiredFieldsHandler();
passwordResetChain
  .setNext(new PasswordMatchHandler())
  .setNext(new PasswordStrengthHandler())
  .setNext(new UserLookupHandler())
  .setNext(new SecurityQuestionsHandler())
  .setNext(new PasswordUpdateHandler());

app.post("/reset_password", async (req, res) => {
  const ctx = { ...req.body, res };
  try {
    await passwordResetChain.handle(ctx);
  } catch (err) {
    console.error("Password reset error:", err);
    return res.redirect(
      `passwordResetForm.html?error=${encodeURIComponent("Reset failed: " + err.message)}`,
    );
  }
});
// ── MVC: Admin Creation Endpoint (for initial setup) ──────────────────────────────
// Model: AdminUsers collection with unique username constraint
// View: No public view, this is intended for initial setup and can be tested via Postman or similar tools
// Controller: This endpoint allows the creation of a new admin user. It validates the input, checks for existing usernames, hashes the password, and inserts the new admin into the database. It also logs the creation event and handles errors gracefully by returning JSON responses.
app.post("/add_admin", async (req, res) => {
  const { fname, lname, email, username, password } = req.body;

  try {
    if (!fname || !lname || !email || !username || !password) {
      return res.json({ success: false, error: "All fields are required." });
    }

    const existing = await db.collection("AdminUsers").findOne({ username });
    if (existing) {
      return res.json({ success: false, error: "Username already exists." });
    }

    const hash = crypto.createHash("sha256").update(password).digest("hex");
    const adminId = await getNextSequence("adminId");
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    await db.collection("AdminUsers").insertOne({
      adminId,
      fname,
      lname,
      email,
      username,
      password: hash,
      user_type: "admin",
      security_questions: [],
      force_password_change: true,
      created_at: now,
      updated_at: now,
    });

    console.log(`New admin created: ${username} (adminId: ${adminId})`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Add admin error:", err);
    return res.json({
      success: false,
      error: "Failed to create admin: " + err.message,
    });
  }
});
// ── MVC: Admin First-Time Setup Endpoint ──────────────────────────────
// Model: AdminUsers collection with force_password_change flag and security questions
// View: admin-setup.html that submits to this endpoint
// Controller: This endpoint ensures that only authenticated admins can access it. It validates the new password and security questions, updates the admin's record in the database, and redirects to the admin dashboard upon success. It also handles errors gracefully by redirecting back to the setup page with appropriate messages.
app.post("/admin_setup", async (req, res) => {
  if (!req.session?.user || req.session.user.user_type !== "admin") {
    return res.redirect("/loginform.html");
  }

  const {
    new_password,
    confirm_password,
    security1,
    answer1,
    security2,
    answer2,
    security3,
    answer3,
  } = req.body;

  const err_redirect = (msg) =>
    res.redirect("/admin-setup.html?error=" + encodeURIComponent(msg));

  try {
    if (!new_password || !confirm_password)
      return err_redirect("All fields are required.");
    if (new_password !== confirm_password)
      return err_redirect("Passwords do not match.");
    if (!security1 || !security2 || !security3)
      return err_redirect("Please select all three security questions.");
    if (!answer1 || !answer2 || !answer3)
      return err_redirect("Please answer all three security questions.");
    if (new Set([security1, security2, security3]).size < 3)
      return err_redirect("Please choose three different security questions.");

    const hash = crypto.createHash("sha256").update(new_password).digest("hex");
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    const security_questions = [
      {
        question: security1,
        answer: crypto
          .createHash("sha256")
          .update((answer1 || "").trim().toLowerCase())
          .digest("hex"),
      },
      {
        question: security2,
        answer: crypto
          .createHash("sha256")
          .update((answer2 || "").trim().toLowerCase())
          .digest("hex"),
      },
      {
        question: security3,
        answer: crypto
          .createHash("sha256")
          .update((answer3 || "").trim().toLowerCase())
          .digest("hex"),
      },
    ];

    await db.collection("AdminUsers").updateOne(
      { username: req.session.user.username },
      {
        $set: {
          password: hash,
          security_questions,
          force_password_change: false,
          updated_at: now,
        },
      },
    );

    req.session.user.force_password_change = false;
    console.log(
      `Admin '${req.session.user.username}' completed first-time setup.`,
    );
    return res.redirect("/adminPage.html");
  } catch (err) {
    console.error("Admin setup error:", err);
    return err_redirect("Setup failed: " + err.message);
  }
});
// Utility function to find a user across all collections for login
async function findUser(db, username, hashedPass) {
  const collections = ["AdminUsers", "RentalUsers", "HostUsers"];
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
// ── MVC: Login Endpoint ──────────────────────────────
// Model: MongoDB collections (AdminUsers, RentalUsers, HostUsers) and session management
// View: loginform.html that submits to this endpoint
// Controller: This endpoint handles user authentication by validating credentials against the database, managing sessions, and redirecting users to their respective dashboards based on their user type. It also logs login events and handles errors gracefully.
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
      force_password_change: user.force_password_change || false,
    };
    req.session.user_name = user.username;
    sessionManager.addSession(user.username, req.sessionID);
    req.session.userData = {
      fname: user.fname,
      lname: user.lname,
      username: user.username,
      user_type: user.user_type,
    };

    if (user.user_type === "admin") {
      if (user.force_password_change) {
        return res.redirect("/admin-setup.html");
      }
      return res.redirect("/adminPage.html");
    } else if (user.user_type === "customer") {
      return res.redirect("/vehicle-reservation.html");
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
// Middleware to protect routes that require authentication
function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.redirect("/loginform.html");
  }
  next();
}
// ── MVC: Home Page Endpoint ──────────────────────────────
// Model: Static HTML/CSS/JS files in the public directory
// View: Home.html as the landing page for all users
// Controller: This endpoint serves as the root URL and redirects to the Home.html page, which is the main entry point for users to navigate to login, registration, or explore the site.
app.get("/", (req, res) => {
  res.set({ "Access-control-Allow-Origin": "*" });
  return res.redirect("Home.html");
});
// ── MVC: Logout Endpoint ──────────────────────────────
// Model: Session management via express-session and SessionManagerSingleton
// View: No specific view, but it redirects to Home.html after logout
// Controller: This endpoint checks for an authenticated session, logs the logout event, removes the session from the SessionManager, destroys the session, clears cookies, and redirects to the homepage.
app.get("/logout", requireLogin, (req, res) => {
  const user = req.session.userData;
  if (user) {
    console.log("User Logged Out", user.fname + " " + user.lname);
  } else {
    console.log("Logout failed: User not Found");
  }
  if (req.session.user?.username)
    sessionManager.removeSession(req.session.user.username);
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout failed:", err);
      return res.status(500).send("Logout failed");
    }
    res.clearCookie("connect.sid");
    res.redirect("/Home.html");
  });
});
// ── MVC: User Detail Endpoint ──────────────────────────────
// Model: MongoDB collections (AdminUsers, RentalUsers, HostUsers)
// View: Used by frontend JavaScript to display user info in the UI
// Controller: This endpoint checks for an authenticated session, retrieves user details from the session, and returns them as JSON for the frontend to consume.
app.get("/userdetail", requireLogin, (req, res) => {
  const user = req.session.user || req.session.userData;

  if (!user) {
    return res.status(401).json({ error: "Not Authenticated" });
  }

  res.json({
    name: [user.fname, user.lname].filter(Boolean).join(" "),
    username: user.username,
    user_type: user.user_type,
    force_password_change: user.force_password_change || false,
  });
});
// ── MVC: Available Vehicles with Booking Conflict Check ──────────────────────────────
// Model: MongoDB collections (Vehicles, Reservations, HostUsers, Reviews)
// View: vehicle-reservation.html that allows filtering by date and shows available vehicles
// Controller: This endpoint checks for overlapping reservations based on provided start and end dates, excludes booked vehicles, enriches available vehicles with host names and review stats, and returns the data as JSON for the frontend to display.
app.get("/api/vehicles/available", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const vehicles = await db.collection("Vehicles").find({}).toArray();

    let bookedVehicleIds = new Set();

    if (start_date && end_date) {
      const overlapping = await db
        .collection("Reservations")
        .find({
          status: { $nin: ["Complete", "Cancelled"] },
          start_date: { $lte: end_date },
          end_date: { $gte: start_date },
        })
        .toArray();

      overlapping.forEach((r) => {
        toIdArray(r.history_vehicle_id || r.vehicle_id).forEach((id) => {
          bookedVehicleIds.add(id.toString());
        });
      });
    }

    const hostUsernames = [
      ...new Set(
        vehicles.filter((v) => v.host_username).map((v) => v.host_username),
      ),
    ];

    const hosts = await db
      .collection("HostUsers")
      .find({ username: { $in: hostUsernames } })
      .toArray();

    const hostMap = {};
    hosts.forEach((h) => {
      hostMap[h.username] = h.fname;
    });

    const reviewStats = await getReviewStatsByVehicleIds(
      vehicles.map((v) => v._id),
    );

    const enriched = vehicles
      .filter((v) => !bookedVehicleIds.has(v._id.toString()))
      .map((v) => {
        const stats = reviewStats[v._id.toString()] || {
          avg_rating: 0,
          review_count: 0,
        };

        return {
          ...v,
          host_fname: v.host_username ? hostMap[v.host_username] || null : null,
          avg_rating: stats.avg_rating,
          review_count: stats.review_count,
        };
      });

    res.json(enriched);
  } catch (err) {
    console.error("Available vehicles error:", err);
    res.status(500).json({ error: "Failed to fetch available vehicles" });
  }
});
// ── MVC: Vehicle Listing with Host and Review Data ──────────────────────────────
// Model: MongoDB collections (Vehicles, HostUsers, Reviews)
// View: vehicle-listing.html that displays vehicles with host names and ratings
// Controller: This endpoint fetches all vehicles, joins host first names from HostUsers, aggregates review stats from Reviews, and returns enriched vehicle data as JSON for the frontend to display.
app.get("/api/vehicles", async (req, res) => {
  try {
    const vehicles = await db.collection("Vehicles").find({}).toArray();

    const hostUsernames = [
      ...new Set(
        vehicles.filter((v) => v.host_username).map((v) => v.host_username),
      ),
    ];

    const hosts = await db
      .collection("HostUsers")
      .find({ username: { $in: hostUsernames } })
      .toArray();

    const hostMap = {};
    hosts.forEach((h) => {
      hostMap[h.username] = h.fname;
    });

    const reviewStats = await getReviewStatsByVehicleIds(
      vehicles.map((v) => v._id),
    );

    const enriched = vehicles.map((v) => {
      const stats = reviewStats[v._id.toString()] || {
        avg_rating: 0,
        review_count: 0,
      };

      return {
        ...v,
        host_fname: v.host_username ? hostMap[v.host_username] || null : null,
        avg_rating: stats.avg_rating,
        review_count: stats.review_count,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("Vehicles error:", err);
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});
// ── MVC: Admin Financial Dashboard ──────────────────────────────
// Model: MongoDB collections (Vehicles, Reservations)
// View: adminPage.html with a financial dashboard section
// Controller: This endpoint aggregates financial data for all vehicles, including total revenue, rentals, and top-performing vehicle, and returns JSON for the frontend to display in the dashboard.
app.get("/api/admin-financials", requireLogin, async (_req, res) => {
  try {
    const vehicles = await db.collection("Vehicles").find({}).toArray();
    if (vehicles.length === 0)
      return res.json({
        totalRevenue: 0,
        totalRentals: 0,
        activeRentals: 0,
        topVehicle: "—",
        vehicles: [],
      });

    const vehicleIdStrings = vehicles.map((v) => v._id.toString());
    const vehicleMap = {};
    vehicles.forEach((v) => {
      vehicleMap[v._id.toString()] = v;
    });

    const allReservations = await db
      .collection("Reservations")
      .find({})
      .toArray();
    const stats = {};
    vehicleIdStrings.forEach((id) => {
      stats[id] = {
        totalRentals: 0,
        activeRentals: 0,
        totalRevenue: 0,
        totalDays: 0,
      };
    });

    allReservations.forEach((r) => {
      const ids = toIdArray(r.history_vehicle_id)
        .map((id) => id.toString())
        .filter((id) => vehicleIdStrings.includes(id));
      const perVehicleCost =
        ids.length > 0 ? (r.total_cost || 0) / ids.length : 0;
      let days = 0;
      if (r.start_date && r.end_date) {
        const diff = new Date(r.end_date) - new Date(r.start_date);
        days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }
      ids.forEach((id) => {
        stats[id].totalRentals++;
        stats[id].totalRevenue += perVehicleCost;
        stats[id].totalDays += days;
        if (r.status === "Booked") stats[id].activeRentals++;
      });
    });

    let totalRevenue = 0,
      totalRentals = 0,
      activeRentals = 0,
      topVehicle = "—",
      topRevenue = -1;
    const vehicleRows = vehicles.map((v) => {
      const id = v._id.toString();
      const s = stats[id];
      const label =
        [v.year, v.make, v.model].filter(Boolean).join(" ") ||
        v.name ||
        "Unknown";
      totalRevenue += s.totalRevenue;
      totalRentals += s.totalRentals;
      activeRentals += s.activeRentals;
      if (s.totalRevenue > topRevenue) {
        topRevenue = s.totalRevenue;
        topVehicle = label;
      }
      return {
        label,
        hostUsername: v.host_username || "N/A",
        category: v.category,
        rate: v.rental_rate_per_day,
        totalRentals: s.totalRentals,
        activeRentals: s.activeRentals,
        totalRevenue: s.totalRevenue,
        avgDays: s.totalRentals > 0 ? s.totalDays / s.totalRentals : 0,
      };
    });

    vehicleRows.sort((a, b) => b.totalRevenue - a.totalRevenue);
    res.json({
      totalRevenue,
      totalRentals,
      activeRentals,
      topVehicle,
      vehicles: vehicleRows,
    });
  } catch (err) {
    console.error("Admin financials error:", err);
    res.status(500).json({ error: "Failed to fetch financials" });
  }
});
// ── MVC: Host Financial Dashboard ──────────────────────────────
// Model: MongoDB collections (Vehicles, Reservations)
// View: ownerPage.html with a financial dashboard section
// Controller: This endpoint aggregates financial data for the logged-in host's vehicles, including total revenue, rentals, and top-performing vehicle, and returns JSON for the frontend to display in the dashboard.
app.get("/api/host-financials", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;

    const vehicles = await db
      .collection("Vehicles")
      .find({ host_username: username })
      .toArray();
    if (vehicles.length === 0)
      return res.json({
        totalRevenue: 0,
        totalRentals: 0,
        activeRentals: 0,
        topVehicle: "—",
        vehicles: [],
      });

    const vehicleIdStrings = vehicles.map((v) => v._id.toString());
    const vehicleMap = {};
    vehicles.forEach((v) => {
      vehicleMap[v._id.toString()] = v;
    });

    const allReservations = await db
      .collection("Reservations")
      .find({})
      .toArray();
    const relevant = allReservations.filter((r) =>
      toIdArray(r.history_vehicle_id).some((id) =>
        vehicleIdStrings.includes(id.toString()),
      ),
    );

    // Per-vehicle stats
    const stats = {};
    vehicleIdStrings.forEach((id) => {
      stats[id] = {
        totalRentals: 0,
        activeRentals: 0,
        totalRevenue: 0,
        totalDays: 0,
      };
    });

    relevant.forEach((r) => {
      if (r.status === "Cancelled") return;

      const ids = toIdArray(r.history_vehicle_id)
        .map((id) => id.toString())
        .filter((id) => vehicleIdStrings.includes(id));
      const perVehicleCost =
        ids.length > 0 ? (r.total_cost || 0) / ids.length : 0;
      let days = 0;
      if (r.start_date && r.end_date) {
        const diff = new Date(r.end_date) - new Date(r.start_date);
        days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }
      ids.forEach((id) => {
        stats[id].totalRentals++;
        stats[id].totalRevenue += perVehicleCost;
        stats[id].totalDays += days;
        if (r.status === "Booked") stats[id].activeRentals++;
      });
    });
    let totalRevenue = 0,
      totalRentals = 0,
      activeRentals = 0,
      topVehicle = "—",
      topRevenue = -1;
    const vehicleRows = vehicles.map((v) => {
      const id = v._id.toString();
      const s = stats[id];
      const label =
        [v.year, v.make, v.model].filter(Boolean).join(" ") ||
        v.name ||
        "Unknown";
      totalRevenue += s.totalRevenue;
      totalRentals += s.totalRentals;
      activeRentals += s.activeRentals;
      if (s.totalRevenue > topRevenue) {
        topRevenue = s.totalRevenue;
        topVehicle = label;
      }
      return {
        vehicleId: id,
        label,
        category: v.category,
        rate: v.rental_rate_per_day,
        totalRentals: s.totalRentals,
        activeRentals: s.activeRentals,
        totalRevenue: s.totalRevenue,
        avgDays: s.totalRentals > 0 ? s.totalDays / s.totalRentals : 0,
      };
    });

    // Sort by revenue descending
    vehicleRows.sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      totalRevenue,
      totalRentals,
      activeRentals,
      topVehicle,
      vehicles: vehicleRows,
    });
  } catch (err) {
    console.error("Host financials error:", err);
    res.status(500).json({ error: "Failed to fetch financials" });
  }
});
// ── MVC: Host Vehicle Rental History ──────────────────────────────
// Model: MongoDB collections (Vehicles, Reservations, RentalUsers)
// View: ownerPage.html with a rental history section
// Controller: This endpoint retrieves the rental history for a specific vehicle owned by the host, including renter details and reservation info, and returns JSON for the frontend to display in a table.
app.get(
  "/api/host-financials/history/:vehicleId",
  requireLogin,
  async (req, res) => {
    try {
      const username = req.session.user_name;
      const { vehicleId } = req.params;

      const vehicle = await db.collection("Vehicles").findOne({
        _id: new ObjectId(vehicleId),
        host_username: username,
      });

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      const reservations = await db
        .collection("Reservations")
        .find({})
        .toArray();

      const matchingReservations = reservations.filter((r) =>
        toIdArray(r.history_vehicle_id).some(
          (id) => id.toString() === vehicleId,
        ),
      );
      const userIds = matchingReservations
        .map((r) => r.user_id)
        .filter((id) => id && ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      const renters = await db
        .collection("RentalUsers")
        .find({ _id: { $in: userIds } })
        .toArray();

      const renterMap = {};
      renters.forEach((u) => {
        renterMap[u._id.toString()] = u;
      });
      const historyRows = matchingReservations.map((r) => {
        const ids = Array.isArray(r.history_vehicle_ids)
          ? r.history_vehicle_ids.map((id) => id.toString())
          : r.vehicle_id
            ? [r.vehicle_id.toString()]
            : [];

        const countForSplit = ids.length || 1;
        const perVehicleCost = (r.total_cost || 0) / countForSplit;

        const renterUser =
          r.user_id && renterMap[r.user_id.toString()]
            ? renterMap[r.user_id.toString()]
            : null;

        return {
          orderId: r.orderId || r._id.toString(),
          renter: r.customer_name || renterUser?.username || "—",
          renterEmail: renterUser?.email || "—",
          startDate: r.start_date || "—",
          returnDate: r.end_date || "—",
          mileage: r.mileage || "—",
          pickupLocation: r.location || r.pickup_location || "—",
          total: perVehicleCost,
          status: r.status || "—",
        };
      });

      historyRows.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

      res.json({
        vehicleId,
        vehicleLabel:
          [vehicle.year, vehicle.make, vehicle.model]
            .filter(Boolean)
            .join(" ") ||
          vehicle.name ||
          "Unknown",
        history: historyRows,
      });
    } catch (err) {
      console.error("Vehicle rental history error:", err);
      res.status(500).json({ error: "Failed to fetch vehicle rental history" });
    }
  },
);
// ── MVC: Host Vehicle Management ──────────────────────────────
// Model: MongoDB collections (Vehicles, HostUsers)
// View: ownerPage.html with forms and tables
// Controller: This endpoint fetches the host's vehicles, enriches them with the host's first name and review stats, and returns JSON for the frontend to render.
app.get("/api/my-vehicles", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const vehicles = await db
      .collection("Vehicles")
      .find({ host_username: username })
      .toArray();
    const host = await db.collection("HostUsers").findOne({ username });
    const host_fname = host ? host.fname : null;
    const enriched = vehicles.map((v) => ({ ...v, host_fname }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});
// ── Observer Pattern: Reservation Notifications ──────────────────────────────
// When a reservation is created, this endpoint checks for conflicts, saves the reservation, and then sends notifications:
// 1. If the reservation is for a future date, it sets status to "Reserved". If it's for today or past, it sets status to "Booked" and marks the vehicle as unavailable until the end date.
// 2. It creates an in-app notification for the host about the new rental.
// 3. It sends a confirmation email to the renter with reservation details.
app.post("/api/reservations", requireLogin, async (req, res) => {
  try {
    const {
      customer_name,
      start_date,
      end_date,
      location,
      address,
      payment,
      vehicle_id,
      total_cost,
    } = req.body;
    if (
      !customer_name ||
      !start_date ||
      !end_date ||
      !location ||
      !address ||
      !payment ||
      !vehicle_id
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const rawId = Array.isArray(vehicle_id) ? vehicle_id[0] : vehicle_id;
    if (!rawId || !/^[a-fA-F0-9]{24}$/.test(String(rawId))) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }
    const objectId = new ObjectId(rawId);

    let user_id = null;
    if (req.session && req.session.user_name) {
      const user = await db
        .collection("RentalUsers")
        .findOne({ username: req.session.user_name });
      if (user && user._id) {
        user_id = user._id;
      }
    }
    const conflict = await db.collection("Reservations").findOne({
      status: { $nin: ["Complete", "Cancelled"] },
      start_date: { $lte: end_date },
      end_date: { $gte: start_date },
      $or: [{ history_vehicle_id: objectId }, { vehicle_id: objectId }],
    });
    if (conflict) {
      return res.status(409).json({
        error:
          "This vehicle is already booked for the requested dates. Please choose different dates or a different vehicle.",
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const reservationStatus = start_date <= today ? "Booked" : "Reserved";
    const vehicle = await db.collection("Vehicles").findOne({ _id: objectId });

    if (!vehicle) {
      return res.status(404).json({ error: "Selected vehicle not found" });
    }

    const vehicleMileage =
      vehicle.mileage !== undefined && vehicle.mileage !== null
        ? Number(vehicle.mileage)
        : null;

    const hostUsername = vehicle.host_username || null;

    const orderId = await getNextSequence("orderId");
    const data = {
      orderId,
      customer_name,
      hostUsername,
      start_date,
      end_date,
      order_date: new Date().toISOString().split("T")[0],
      location,
      address,
      payment,
      status: reservationStatus,
      history_vehicle_id: objectId,
      vehicle_id: objectId,
      ...(user_id && { user_id }),
      ...(total_cost && { total_cost: Number(total_cost) }),
      ...(vehicleMileage !== null ? { mileage: vehicleMileage } : {}),
      created_at: new Date().toISOString().replace("T", " ").substring(0, 19),
      updated_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    };
    await db.collection("Reservations").insertOne(data);

    if (hostUsername) {
      try {
        const vehicleName =
          [vehicle.year, vehicle.make, vehicle.model]
            .filter(Boolean)
            .join(" ") || "your vehicle";
        await db.collection("Notifications").insertOne({
          username: hostUsername,
          type: "new_rental",
          message: `${customer_name} has rented ${vehicleName} from ${start_date} to ${end_date}.`,
          link: "/ownerPage.html#financial-management",
          vehicle_id: objectId,
          read: false,
          createdAt: new Date(),
        });
      } catch (err) {
        console.error(
          "[Notify] Failed to send host rental notification:",
          err.message,
        );
      }
    }

    // Send confirmation email to renter
    const renterUser = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (renterUser?.email) {
      const usedPayment = (renterUser.payment || []).find(
        (p) => p.payment_nickname === payment || p.last4 === payment,
      );
      const last4 = usedPayment?.last4 || null;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      sendReservationEmail(
        renterUser.email,
        data,
        vehicle,
        last4,
        baseUrl,
        req.session.user_name,
      );
    }
    if (reservationStatus === "Booked") {
      await db.collection("Vehicles").updateOne(
        { _id: objectId },
        {
          $set: {
            availability: false,
            unavailable_until: new Date(end_date),
          },
        },
      );
    }

    res.json({ message: "Reservation created successfully", ...data });
  } catch (err) {
    console.log(`Insert error to the ${dbname} database`, err);
    res
      .status(500)
      .json({ error: "Failed to create reservation: " + err.message });
  }
});
//------Oberver pattern implementation for reservation notifications (also used for host rental alerts)------//
// Sends a reservation confirmation email and saves an in-app notification for the user after a booking is confirmed.
async function sendReservationEmail(
  to,
  reservation,
  vehicle,
  last4,
  baseUrl,
  username,
) {
  if (username && db) {
    try {
      const vehicleName =
        [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
        "Your Vehicle";
      await db.collection("Notifications").insertOne({
        username,
        type: "reservation_confirmed",
        message: `Your reservation for ${vehicleName} (${reservation.start_date} → ${reservation.end_date}) has been confirmed. Confirmation #${reservation._id}.`,
        link: "/vehicle-reservation.html",
        vehicle_id: vehicle._id,
        reservation_id: reservation._id,
        read: false,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error(
        "[Observer] Failed to save reservation notification:",
        err.message,
      );
    }
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return;

  const vehicleName =
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    "Your Vehicle";
  const imageRaw = vehicle.image_url || vehicle.image || "";
  const imageUrl = imageRaw ? `${baseUrl}/${imageRaw}` : "";
  const confirmationNumber = String(reservation._id);
  const total = Number(reservation.total_cost || 0).toFixed(2);

  try {
    await mailer.sendMail({
      from: `"DriveShare" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Reservation Confirmed — ${vehicleName}`,
      html: `
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #ddd;">

        <!-- Header -->
        <tr>
          <td bgcolor="#ea8900" style="padding:18px 24px;">
            <h2 style="color:#ffffff;margin:0;font-size:18px;font-weight:bold;">
              Thank you ${reservation.customer_name.toUpperCase()}, your car has been reserved.
            </h2>
          </td>
        </tr>

        <!-- Dates + Confirmation -->
        <tr>
          <td bgcolor="#1a1a1a" style="padding:18px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" style="color:#ffffff;vertical-align:top;padding-bottom:8px;">
                  <span style="color:#4fc3f7;font-weight:bold;">Pick up:</span><br>
                  <span style="color:#ffffff;">${reservation.start_date}</span>
                </td>
                <td width="50%" style="color:#ffffff;vertical-align:top;padding-bottom:8px;">
                  <span style="color:#ffffff;font-weight:bold;">Your Confirmation Number:</span><br>
                  <span style="color:#4fc3f7;font-weight:bold;font-size:14px;">${confirmationNumber}</span>
                </td>
              </tr>
              <tr>
                <td style="color:#ffffff;vertical-align:top;">
                  <span style="color:#4fc3f7;font-weight:bold;">Drop off:</span><br>
                  <span style="color:#ffffff;">${reservation.end_date}</span>
                </td>
                <td></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Vehicle + Pricing -->
        <tr>
          <td bgcolor="#111111" style="padding:18px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="45%" style="vertical-align:top;padding-right:16px;">
                  ${imageUrl ? `<img src="${imageUrl}" alt="${vehicleName}" width="200" style="display:block;width:200px;max-width:100%;border-radius:4px;">` : ""}
                  <p style="margin:10px 0 0;font-weight:bold;font-size:22px;color:#ffffff;">${vehicleName}</p>
                  <p style="margin:12px 0 0;font-weight:bold;font-size:13px;color:#ffffff;">Current Mileage:</p>
                  <p style="margin:2px 0 0;color:#4fc3f7;font-weight:bold;font-size:14px;">${Number(vehicle.mileage).toLocaleString()} miles</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#ffffff;">Miles: Unlimited free Miles</p>
                  <p style="margin:5px 0 0;font-weight:bold;font-size:13px;color:#ffffff;">Your Order Number:</p>
                  <p style="margin:2px 0 0;color:#4fc3f7;font-weight:bold;font-size:14px;">${reservation.orderId}</p>
                </td>
                <td width="55%" style="vertical-align:top;text-align:right;">
                  <p style="color:#4fc3f7;font-weight:bold;margin:0 0 4px;font-size:13px;">Estimated Total:</p>
                  <p style="font-size:28px;font-weight:bold;margin:0;color:#ffffff;">$${total}</p>
                  ${last4 ? `<p style="margin:8px 0 0;font-size:12px;color:#aaaaaa;">Charged to card ending in <strong style="color:#ffffff;">${last4}</strong></p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Location -->
        <tr>
          <td bgcolor="#1e3a5f" style="padding:14px 24px;">
            <p style="color:#ffffff;margin:0 0 12px;font-size:15px;font-weight:bold;">Location Information</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" style="vertical-align:top;padding-right:16px;">
                  <span style="color:#4fc3f7;font-weight:bold;font-size:13px;">Pick Up Location</span><br>
                  <span style="color:#ffffff;font-size:13px;">${reservation.location}</span>
                </td>
                <td width="50%" style="vertical-align:top;">
                  <span style="color:#4fc3f7;font-weight:bold;font-size:13px;">Drop Off Location</span><br>
                  <span style="color:#ffffff;font-size:13px;">${reservation.location}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="#111111" style="padding:12px 24px;text-align:center;">
            <p style="color:#aaaaaa;font-size:12px;margin:0;">
              Thank you for choosing DriveShare. Questions? Contact us at
              <a href="mailto:${process.env.GMAIL_USER}" style="color:#4fc3f7;">${process.env.GMAIL_USER}</a>
            </p>
          </td>
        </tr>

      </table>
      `,
    });
  } catch (err) {
    console.error("Failed to send reservation email:", err.message);
  }
}

// ── Proxy Pattern: Payment Processing ─────────────────────────────────────
//
// PaymentService      – abstract subject (interface)
// FakePaymentService  – real subject: simulates approve / decline / error outcomes
// PaymentProxy        – proxy: enforces access control, logs every operation,
//                        then delegates charge() to the real service

// ── Abstract subject ─────────────────────────────────────────────────────────
class PaymentService {
  async charge(_details) {
    throw new Error("charge() not implemented");
  }
}

// ── Real subject ─────────────────────────────────────────────────────────────
// Simulates a payment processor with no external dependency.
// Outcome is determined by card state and requested amount:
//
//   card.status !== "Active"  →  CARD_INACTIVE      (card is inactive)
//   amount > 9 999            →  INSUFFICIENT_FUNDS (balance too low)
//   amount > 4 999            →  DECLINED           (bank declined)
//   otherwise                 →  APPROVED + fake transaction ID
class FakePaymentService extends PaymentService {
  async charge({ card, amount }) {
    if (!card || card.status !== "Active") {
      return {
        approved: false,
        code: "CARD_INACTIVE",
        message: "Card is inactive.",
      };
    }
    if (amount > 9999) {
      return {
        approved: false,
        code: "INSUFFICIENT_FUNDS",
        message: "Insufficient funds.",
      };
    }
    if (amount > 4999) {
      return {
        approved: false,
        code: "DECLINED",
        message: "Payment declined.",
      };
    }
    const transactionId =
      "TXN-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 10).toUpperCase();
    return { approved: true, transactionId };
  }
}

// ── Proxy Pattern ────────────────────────────────────────────────────────────────────
// The proxy adds a layer of control and logging around the payment processing.
// It verifies the user and card details, logs the charge attempt, and then delegates to the real payment service.
// It also provides additional methods for managing saved payment methods (cards) for users.
// The proxy ensures that only valid, active cards can be charged, and that all operations are logged for auditing purposes.
// This design allows us to swap out the underlying payment service in the future (e.g., integrate with Stripe or PayPal) without changing the rest of our application code, as all interactions go through the PaymentProxy.
// The proxy also centralizes all payment-related logic, making it easier to maintain and enhance (e.g., adding fraud detection, retry logic, etc.) without scattering that code across the application.
// The proxy assumes that user payment methods are stored in the RentalUsers collection under a "payment" array, where each entry includes at least last4, expiration, and status fields. It uses this information to validate charge requests and manage saved cards.
class PaymentProxy extends PaymentService {
  constructor(realService) {
    super();
    this._service = realService;
  }

  async _resolveUser(username) {
    const user = await db.collection("RentalUsers").findOne({ username });
    if (!user)
      throw Object.assign(new Error("User not found"), { status: 404 });
    return user;
  }

  // Intercepts charge requests: verifies user, finds card, logs, delegates
  async charge({ username, amount, last4, expiration }) {
    const user = await this._resolveUser(username);
    const card = (user.payment || []).find(
      (p) => p.last4 === last4 && p.expiration === expiration,
    );
    if (!card)
      throw Object.assign(new Error("Payment method not found"), {
        status: 404,
      });

    console.log(
      `[PaymentProxy] charge – user: ${username}, amount: $${amount}, last4: ${last4}`,
    );
    const result = await this._service.charge({ card, amount });
    console.log(
      `[PaymentProxy] charge – ${result.approved ? "APPROVED " + result.transactionId : result.code}`,
    );
    return result;
  }
  // Validates and saves a new card for the user, ensuring no duplicates and proper formatting
  async saveCard(details) {
    const { username } = details;
    const user = await this._resolveUser(username);

    if (!/^\d{4}-\d{2}$/.test(details.expiration)) {
      throw Object.assign(new Error("Invalid expiration date format"), {
        status: 400,
      });
    }
    const cleanCard = details.card_number.replace(/\D/g, "");
    if (cleanCard.length < 13 || cleanCard.length > 19) {
      throw Object.assign(new Error("Invalid card number length"), {
        status: 400,
      });
    }

    const last4 = cleanCard.slice(-4);
    const [year, month] = details.expiration.split("-");
    const exp = `${month}/${String(year).slice(-2)}`;

    const duplicate = (user.payment || []).some(
      (p) => p.last4 === last4 && p.expiration === exp,
    );
    if (duplicate) {
      throw Object.assign(
        new Error("A card with that number and expiration is already saved"),
        { status: 409 },
      );
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const entry = {
      customer_name: details.full_name,
      payment_address: details.address,
      last4,
      card_type: details.card_type,
      expiration: exp,
      payment_zip_code: details.payment_zip_code,
      payment_nickname: details.payment_nickname,
      status: "Active",
      added_at: now,
    };

    console.log(`[PaymentProxy] saveCard – user: ${username}, last4: ${last4}`);
    await db
      .collection("RentalUsers")
      .updateOne(
        { _id: user._id },
        { $push: { payment: entry }, $set: { updated_at: now } },
      );
    console.log(`[PaymentProxy] saveCard – success for user: ${username}`);
    return entry;
  }
  // Lists saved cards for a user, excluding sensitive details
  async listCards(username) {
    const user = await this._resolveUser(username);
    const fresh = await db
      .collection("RentalUsers")
      .findOne({ _id: user._id }, { projection: { payment: 1 } });
    return (fresh?.payment || []).map((p) => ({
      customer_name: p.customer_name || "N/A",
      payment_address: p.payment_address || "N/A",
      last4: p.last4,
      expiration: p.expiration,
      status: p.status || "Active",
      card_type: p.card_type || "N/A",
      payment_nickname: p.payment_nickname || "N/A",
    }));
  }
  // Deletes a saved card by last4 + expiration (since we don't store full card numbers)
  async deleteCard(username, { last4, expiration }) {
    const user = await this._resolveUser(username);
    console.log(
      `[PaymentProxy] deleteCard – user: ${username}, last4: ${last4}, exp: ${expiration}`,
    );
    const result = await db
      .collection("RentalUsers")
      .updateOne(
        { _id: user._id },
        { $pull: { payment: { last4, expiration } } },
      );
    if (result.modifiedCount === 0)
      throw Object.assign(new Error("Payment method not found"), {
        status: 404,
      });
    return true;
  }
}

// Instantiate once at startup
const paymentProxy = new PaymentProxy(new FakePaymentService());

// ── Routes (thin wrappers – all logic lives in the proxy / gateway) ──────────
// Add a new payment method for the logged-in user
// Expects: full_name, address, payment_nickname, card_number, expiration (YYYY-MM), card_type, payment_zip_code
// Validates input, checks for duplicates, saves to user's payment array in DB
// Returns the saved card entry (without card number, only last4) or an error message
app.post("/payments", requireLogin, async (req, res) => {
  const required = [
    "full_name",
    "address",
    "payment_nickname",
    "card_number",
    "expiration",
    "card_type",
    "payment_zip_code",
  ];
  for (const field of required) {
    if (!req.body[field])
      return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const entry = await paymentProxy.saveCard({
      ...req.body,
      username: req.session.user_name,
    });
    return res.json({ success: true, ...entry });
  } catch (e) {
    console.error("Payment error:", e.message);
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Server error" });
  }
});
// List saved payment methods for the logged-in user
app.post("/addresses", requireLogin, async (req, res) => {
  const {
    customer_name,
    street,
    city,
    state,
    zip_code,
    phone_number,
    address_nickname,
  } = req.body;
  if (
    !customer_name ||
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
          customer_name: customer_name || " ",
          address_line1: street || " ",
          city: city || " ",
          state: state || " ",
          zip_code: zip_code || " ",
          phone_number: phone_number || " ",
          address_nickname: address_nickname || " ",
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
    return res.redirect(`vehicle-reservation.html`);
  }
});
// ── Vehicle Return ─────────────────────────────────────────────────────────
//
// When a renter returns a vehicle, they submit the return mileage. The system verifies the booking,
// updates the reservation status to "Complete", sets the return mileage, and marks the vehicle as available again.
// If the return mileage is less than the pickup mileage, an error is returned.
app.post("/api/return", requireLogin, async (req, res) => {
  try {
    if (!req.session || !req.session.user_name) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }
    const { vehicleId, returnMileage } = req.body;
    if (!vehicleId) {
      return res
        .status(400)
        .json({ success: false, error: "No vehicle ID provided" });
    }
    if (
      returnMileage === undefined ||
      returnMileage === null ||
      returnMileage === ""
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Return mileage is required" });
    }
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const reservations = await db
      .collection("Reservations")
      .find({ user_id: user._id, status: "Booked" })
      .toArray();
    const reservation = reservations.find((resv) =>
      toIdArray(resv.vehicle_id).some((id) => id.toString() === vehicleId),
    );
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "No active booking found for this vehicle.",
      });
    }

    let eqId = ObjectId.isValid(vehicleId)
      ? new ObjectId(vehicleId)
      : vehicleId;
    const vehicle = await db.collection("Vehicles").findOne({ _id: eqId });
    if (vehicle) {
      const returnMileageInt = parseInt(returnMileage);
      if (
        isNaN(returnMileageInt) ||
        (vehicle.mileage !== undefined && returnMileageInt < vehicle.mileage)
      ) {
        return res.status(400).json({
          success: false,
          error: `Return mileage (${returnMileageInt.toLocaleString()}) cannot be less than the pickup mileage (${Number(vehicle.mileage).toLocaleString()}).`,
        });
      }

      await db.collection("Reservations").updateOne(
        { _id: reservation._id },
        {
          $set: {
            vehicle_id: null,
            status: "Complete",
            return_mileage: returnMileageInt,
            updated_at: new Date()
              .toISOString()
              .replace("T", " ")
              .substring(0, 19),
          },
        },
      );

      const newQty = (vehicle.quantity_available || 0) + 1;
      await db.collection("Vehicles").updateOne(
        { _id: eqId },
        {
          $set: {
            quantity_available: newQty,
            availability: newQty > 0,
            mileage: returnMileageInt,
          },
          $unset: { unavailable_until: "" },
        },
      );
    } else {
      // No vehicle record found — still complete the reservation
      await db.collection("Reservations").updateOne(
        { _id: reservation._id },
        {
          $set: {
            vehicle_id: null,
            status: "Complete",
            updated_at: new Date()
              .toISOString()
              .replace("T", " ")
              .substring(0, 19),
          },
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
// ── Reservation Cancellation ───────────────────────────────
//
// Reservations have a "status" field that can be "Reserved", "Booked", "Cancelled", or "Complete".
// Only "Reserved" bookings can be cancelled by the renter. Cancellation updates the status and timestamps,
// and notifies the host if applicable.
app.post("/api/cancel-reservation", requireLogin, async (req, res) => {
  try {
    const { reservationId } = req.body;
    if (!reservationId || !ObjectId.isValid(reservationId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid reservation ID." });
    }
    const resv = await db
      .collection("Reservations")
      .findOne({ _id: new ObjectId(reservationId) });
    if (!resv) {
      return res
        .status(404)
        .json({ success: false, error: "Reservation not found." });
    }
    if (resv.status !== "Reserved") {
      return res.status(400).json({
        success: false,
        error: "Only Reserved bookings can be cancelled.",
      });
    }
    await db.collection("Reservations").updateOne(
      { _id: new ObjectId(reservationId) },
      {
        $set: {
          status: "Cancelled",
          updated_at: new Date()
            .toISOString()
            .replace("T", " ")
            .substring(0, 19),
        },
      },
    );
    console.log(
      `[CANCEL] Reservation ${reservationId} (Order #${resv.orderId}) cancelled by user at ${new Date().toISOString()}`,
    );

    // Notify the host that a renter cancelled
    if (resv.hostUsername) {
      try {
        const vehicleDoc = await db
          .collection("Vehicles")
          .findOne({ _id: resv.history_vehicle_id || resv.vehicle_id });
        const vehicleName = vehicleDoc
          ? [vehicleDoc.year, vehicleDoc.make, vehicleDoc.model]
              .filter(Boolean)
              .join(" ")
          : "your vehicle";
        await db.collection("Notifications").insertOne({
          username: resv.hostUsername,
          type: "rental_cancelled",
          message: `${resv.customer_name} has cancelled their reservation for ${vehicleName} (${resv.start_date} to ${resv.end_date}).`,
          link: "/ownerPage.html#financial-management",
          vehicle_id: resv.history_vehicle_id || resv.vehicle_id,
          read: false,
          createdAt: new Date(),
        });
      } catch (err) {
        console.error(
          "[Notify] Failed to send host cancellation notification:",
          err.message,
        );
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: "Server error: " + err.message });
  }
});
// ── Observer Pattern: Availability Watcher ─────────────────────────────────
//
// Vehicles have an "availability" boolean and "unavailable_until" date.
setInterval(async () => {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Restore availability for vehicles whose rental period has ended
    await db.collection("Vehicles").updateMany(
      {
        unavailable_until: { $lte: now },
        availability: false,
        quantity_available: { $gt: 0 },
      },
      { $set: { availability: true }, $unset: { unavailable_until: "" } },
    );

    // Self-heal: restore vehicles marked unavailable with no active reservation
    const unavailableVehicles = await db
      .collection("Vehicles")
      .find({ availability: false })
      .toArray();
    for (const v of unavailableVehicles) {
      const activeResv = await db.collection("Reservations").findOne({
        $or: [{ vehicle_id: v._id }, { history_vehicle_id: v._id }],
        status: { $in: ["Booked", "Reserved"] },
      });
      if (!activeResv) {
        await db
          .collection("Vehicles")
          .updateOne(
            { _id: v._id },
            { $set: { availability: true }, $unset: { unavailable_until: "" } },
          );
        console.log(`Restored orphaned vehicle: ${v._id}`);
      }
    }

    // Promote Reserved → Booked when start date is today, mark vehicle unavailable
    const toPromote = await db
      .collection("Reservations")
      .find({
        status: "Reserved",
        start_date: { $lte: today },
      })
      .toArray();

    for (const resv of toPromote) {
      await db.collection("Reservations").updateOne(
        { _id: resv._id },
        {
          $set: {
            status: "Booked",
            updated_at: new Date()
              .toISOString()
              .replace("T", " ")
              .substring(0, 19),
          },
        },
      );
      const vehicleId = resv.history_vehicle_id || resv.vehicle_id;
      if (vehicleId) {
        await db.collection("Vehicles").updateOne(
          { _id: vehicleId },
          {
            $set: {
              availability: false,
              unavailable_until: new Date(resv.end_date),
            },
          },
        );
      }
    }

    // Get all vehicles that are currently available
    const availableVehicles = await db
      .collection("Vehicles")
      .find({ availability: true })
      .toArray();

    for (const vehicle of availableVehicles) {
      const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" ");

      // Find all watchers for this vehicle
      const watchers = await db
        .collection("WatchList")
        .find({ vehicle_id: vehicle._id })
        .toArray();

      for (const watcher of watchers) {
        const notifications = [];

        // Check 1: Vehicle became available (notify_available)
        if (watcher.notify_available !== false) {
          notifications.push({
            type: "car_available",
            message: `Good news! ${vehicleLabel} is now available for rental.`,
            link: "/vehicle-reservation.html",
          });
        }

        // Check 2: Price dropped below watcher's target price
        if (
          watcher.target_price &&
          vehicle.rental_rate_per_day <= watcher.target_price
        ) {
          notifications.push({
            type: "price_drop",
            message: `Price alert! ${vehicleLabel} is now $${vehicle.rental_rate_per_day}/day — at or below your target of $${watcher.target_price}/day.`,
            link: "/vehicle-reservation.html",
          });
        }

        // Send each notification
        for (const notif of notifications) {
          const recentNotif = await db.collection("Notifications").findOne({
            username: watcher.username,
            type: notif.type,
            vehicle_id: vehicle._id,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          });

          if (recentNotif) continue; // Already notified recently, skip

          // Save email notification
          await db.collection("Notifications").insertOne({
            username: watcher.username,
            type: notif.type,
            message: notif.message,
            link: notif.link,
            vehicle_id: vehicle._id,
            read: false,
            createdAt: new Date(),
          });

          console.log(
            `[Observer] Notified ${watcher.username}: ${notif.message}`,
          );

          // Send email notification
          const renter =
            (await db
              .collection("RentalUsers")
              .findOne({ username: watcher.username })) ||
            (await db
              .collection("HostUsers")
              .findOne({ username: watcher.username }));

          if (
            renter?.email &&
            process.env.GMAIL_USER &&
            process.env.GMAIL_PASS
          ) {
            try {
              await mailer.sendMail({
                from: `"DriveShare" <${process.env.GMAIL_USER}>`,
                to: renter.email,
                subject: `DriveShare Alert: ${vehicleLabel}`,
                html: `
              <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
                <div style="background:#e8604c; padding:16px 24px;">
                  <h2 style="color:#fff; margin:0; font-size:18px;">
                    ${notif.type === "price_drop" ? "💰 Price Drop Alert" : "🚗 Vehicle Available"}
                  </h2>
                </div>
                <div style="padding:24px;">
                  <p style="font-size:15px; color:#333;">${notif.message}</p>
                  <a href="https://driveshare-6b05ff2378e7.herokuapp.com/vehicle-reservation.html?vehicleId=${vehicle._id}&unwatch=1"
                    style="display:inline-block; margin-top:16px; padding:10px 24px; background:#e8604c; color:#fff; border-radius:6px; text-decoration:none; font-weight:bold;">
                    Reserve Now
                  </a>
                  <p style="margin-top:12px; font-size:12px; color:#888;">
                    ⚠️ Clicking "Reserve Now" will automatically remove this vehicle from your watchlist.
                  </p>
                </div>
                <div style="padding:12px 24px; background:#f9f9f9; font-size:12px; color:#888;">
                  You're receiving this because you're watching ${vehicleLabel} on DriveShare.
                </div>
              </div>
            `,
              });
              console.log(`[Observer] Email sent to ${renter.email}`);
            } catch (emailErr) {
              console.error(
                `[Observer] Email failed for ${watcher.username}:`,
                emailErr.message,
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error updating vehicle availability:", err);
  }
}, 60 * 1000);
// Fetches the logged-in user's information and returns their full name. If no user is logged in, returns "Customer" as a default name.
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
// Fetches the user's past and current reservations, enriches them with vehicle details and mileage driven, and returns them in a structured format.
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

    // Filter to only active reservations first, then look up their vehicles
    const activeReservations = reservations.filter(
      (r) => r.status === "Booked" || r.status === "Reserved",
    );
    if (activeReservations.length === 0) {
      return res.json([]);
    }

    const vehicleIds = activeReservations
      .map((r) => {
        const rawId = r.vehicle_id || r.history_vehicle_id;
        try {
          return rawId && ObjectId.isValid(rawId) ? new ObjectId(rawId) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const vehicles = await db
      .collection("Vehicles")
      .find({ _id: { $in: vehicleIds } })
      .toArray();
    const vehicleMap = {};
    vehicles.forEach((v) => {
      vehicleMap[v._id.toString()] = v;
    });

    const result = activeReservations.map((resv) => {
      const vid = (resv.vehicle_id || resv.history_vehicle_id)?.toString();
      const eq = vehicleMap[vid] || {};
      return {
        id: eq._id || resv.vehicle_id,
        reservationId: resv._id,
        status: resv.status,
        name:
          [eq.year, eq.make, eq.model].filter(Boolean).join(" ") ||
          eq.name ||
          "Unknown Vehicle",
        description: eq.description || "",
        image: eq.image_url || eq.image || "",
        mileage: eq.mileage ?? null,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user rentals" });
  }
});
// Fetches the user's past and current reservations, enriches them with vehicle details and mileage driven, and returns them in a structured format.
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

    const allVehicleIds = reservations.flatMap((r) =>
      toIdArray(r.history_vehicle_id),
    );
    const uniqueIds = [...new Set(allVehicleIds.map((id) => id.toString()))];
    const objectIds = uniqueIds
      .map((id) => (ObjectId.isValid(id) ? new ObjectId(id) : null))
      .filter(Boolean);

    const vehicleMap = {};
    const vehicleDocs = await db
      .collection("Vehicles")
      .find({ _id: { $in: objectIds } })
      .toArray();
    vehicleDocs.forEach((eq) => {
      vehicleMap[eq._id.toString()] = {
        name:
          [eq.year, eq.make, eq.model].filter(Boolean).join(" ") ||
          eq.name ||
          "Unknown Vehicle",
        mileage: eq.mileage,
      };
    });

    const result = reservations.map((r) => {
      const vehicleEntries = toIdArray(r.history_vehicle_id).map(
        (id) =>
          vehicleMap[id.toString()] || { name: "Unknown", mileage: undefined },
      );
      let miles_driven = 0;
      if (
        r.status !== "Cancelled" &&
        r.return_mileage != null &&
        r.mileage != null
      ) {
        miles_driven = Math.max(
          0,
          Number(r.return_mileage) - Number(r.mileage),
        );
      }
      return {
        order_id: r.orderId || "N/A",
        order_date: r.order_date,
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status || "Booked",
        location: r.location || "",
        total_cost: r.total_cost || 0,
        items: vehicleEntries.map((v) => v.name),
        miles_driven,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});
// Fetches the user's saved payment methods from their profile and returns them in a structured format.
app.get("/api/mypayments", async (req, res) => {
  if (!req.session?.user_name)
    return res.status(401).json({ error: "Not logged in" });
  try {
    const cards = await paymentProxy.listCards(req.session.user_name);
    res.json(cards);
  } catch (err) {
    console.error(err);
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to fetch Payment Methods" });
  }
});
// Fetches the user's saved addresses from their profile and returns them in a structured format.
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
// Deletes a payment method from the user's saved cards based on last4 and expiration.
app.delete("/api/delete-payment", requireLogin, async (req, res) => {
  const { last4, expiration } = req.body;
  try {
    await paymentProxy.deleteCard(req.session.user_name, { last4, expiration });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete payment error:", err.message);
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to remove Payment Method" });
  }
});
// Deletes an address from the user's address book based on the unique nickname.
app.post("/api/delete-address", async (req, res) => {
  const { address_nickname, address_line1 } = req.body;
  if (!req.session || !req.session.user_name) {
    return res.status(401).json({ error: "Not logged in" });
  }
  if (!address_nickname) {
    return res.status(400).json({ error: "address_nickname is required" });
  }

  try {
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });
    if (!user) return res.status(404).json({ error: "User not found" });

    console.log(
      "Deleting address:",
      address_nickname,
      "for user:",
      req.session.user_name,
    );
    console.log("User address array:", JSON.stringify(user.address));

    const result = await db
      .collection("RentalUsers")
      .updateOne(
        { _id: user._id },
        { $pull: { address: { address_nickname } } },
      );
    console.log("Pull result modifiedCount:", result.modifiedCount);
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

// ── Builder Pattern: Car Listing Creation ────────────────────────────────────
// VehicleListingBuilder assembles a vehicle document step-by-step.
// Each setter returns `this` for fluent chaining.
// build() validates required fields and returns the final plain object.

class VehicleListingBuilder {
  constructor() {
    // Defaults applied to every listing
    this._doc = {
      availability: true,
      quantity_available: 1,
      description: "",
      image_url: "",
      host_username: null,
    };
  }

  setBasicInfo(year, make, model, category) {
    this._doc.year = year ? parseInt(year) : null;
    this._doc.make = make ? make.trim() : "";
    this._doc.model = model ? model.trim() : "";
    this._doc.category = category ? category.trim() : "";
    return this;
  }

  setDescription(description) {
    this._doc.description = description ? description.trim() : "";
    return this;
  }

  setPricing(rental_rate_per_day) {
    this._doc.rental_rate_per_day = parseFloat(rental_rate_per_day);
    return this;
  }

  setSpecs(mileage, range) {
    if (mileage !== undefined && mileage !== "")
      this._doc.mileage = parseInt(mileage);
    if (range !== undefined && range !== "") this._doc.range = parseInt(range);
    return this;
  }

  setLocation(pickup_location) {
    if (pickup_location) this._doc.pickup_location = pickup_location.trim();
    return this;
  }

  setMedia(imagePath) {
    if (imagePath) this._doc.image_url = imagePath;
    return this;
  }

  setHost(username) {
    this._doc.host_username = username || null;
    return this;
  }

  // Used by the update route — stamps updated_at instead of created_at
  asUpdate() {
    this._isUpdate = true;
    return this;
  }

  build() {
    const required = [
      "year",
      "make",
      "model",
      "category",
      "rental_rate_per_day",
    ];
    for (const field of required) {
      if (!this._doc[field] && this._doc[field] !== 0) {
        throw Object.assign(new Error(`${field} is required`), { status: 400 });
      }
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    if (this._isUpdate) {
      this._doc.updated_at = now;
    } else {
      this._doc.created_at = now;
    }

    return { ...this._doc };
  }
}
// ── Vehicle Management (host-only) ───────────────────────────
// POST   /api/vehicle      – create a new listing (with optional image upload)
// DELETE /api/vehicle/:id  – remove a listing by ID
// PUT    /api/vehicle/:id  – update a listing and notify watchers of price drops
app.post(
  "/api/vehicle",
  requireLogin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (req.session.user.user_type !== "host") {
        return res.status(403).json({ error: "Only hosts can add vehicles" });
      }

      const {
        year,
        make,
        model,
        category,
        description,
        rental_rate_per_day,
        mileage,
        range,
        pickup_location,
        image_url,
      } = req.body;

      // Prefer uploaded file; fall back to image_url string
      const imagePath = req.file
        ? "assets/img/vehicles/" + req.file.filename
        : image_url || "";

      let vehicleData;
      try {
        vehicleData = new VehicleListingBuilder()
          .setBasicInfo(year, make, model, category)
          .setDescription(description)
          .setPricing(rental_rate_per_day)
          .setSpecs(mileage, range)
          .setLocation(pickup_location)
          .setMedia(imagePath)
          .setHost(req.session.user.username)
          .build();
      } catch (validationErr) {
        return res
          .status(validationErr.status || 400)
          .json({ error: validationErr.message });
      }

      const result = await db.collection("Vehicles").insertOne(vehicleData);
      res.json({
        success: true,
        message: "Vehicle added successfully",
        vehicle: { _id: result.insertedId, ...vehicleData },
      });
    } catch (err) {
      console.error("Add vehicle error:", err);
      res.status(500).json({ error: "Failed to add vehicle" });
    }
  },
);
app.delete("/api/vehicle/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const result = await db
      .collection("Vehicles")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount > 0) {
      res.json({ success: true, message: "Vehicle deleted successfully" });
    } else {
      res.json({ success: false, error: "Vehicle not found" });
    }
  } catch (err) {
    console.error("Delete vehicle error:", err);
    res.status(500).json({ error: "Failed to delete vehicle" });
  }
});
app.put(
  "/api/vehicle/:id",
  requireLogin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        model,
        category,
        description,
        rental_rate_per_day,
        make,
        year,
        mileage,
        range,
        pickup_location,
      } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid vehicle ID" });
      }

      if (!model || !category || !rental_rate_per_day || !make || !year) {
        return res.status(400).json({
          error: "Year, make, model, category, and rental rate are required",
        });
      }

      const imagePath = req.file
        ? "assets/img/vehicles/" + req.file.filename
        : "";

      const updateData = new VehicleListingBuilder()
        .setBasicInfo(year, make, model, category)
        .setDescription(description)
        .setPricing(rental_rate_per_day)
        .setSpecs(mileage, range)
        .setLocation(pickup_location)
        .setMedia(imagePath)
        .asUpdate()
        .build();

      const before = await db
        .collection("Vehicles")
        .findOne(
          { _id: new ObjectId(id) },
          { projection: { rental_rate_per_day: 1 } },
        );
      const oldPrice = before?.rental_rate_per_day ?? null;

      const result = await db
        .collection("Vehicles")
        .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

      if (result.modifiedCount > 0) {
        res.json({ success: true, message: "Vehicle updated successfully" });
        // Notify watchers asynchronously if price dropped
        const newPrice = updateData.rental_rate_per_day;
        if (oldPrice !== null && newPrice < oldPrice) {
          notifyWatchers(id, "price", newPrice);
        }
      } else {
        res.json({
          success: false,
          error: "Vehicle not found or no changes made",
        });
      }
    } catch (err) {
      console.error("Update Vehicle error:", err);
      res.status(500).json({ error: "Failed to update Vehicle" });
    }
  },
);
// Updates a vehicle’s availability status and notifies watchers if the vehicle becomes available.
app.patch("/api/vehicle/:id/availability", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const { availability } = req.body;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid vehicle ID" });
    await db
      .collection("Vehicles")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { availability: !!availability } },
      );
    res.json({ success: true });
    // Notify watchers asynchronously when vehicle becomes available
    if (availability) notifyWatchers(id, "availability", true);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update availability" });
  }
});
// ── Watchlist notification helper ───────────────────────────────────────────
// changeType: "availability" (vehicle became available) | "price" (price dropped)
// newValue  : true for availability; new price number for price
async function notifyWatchers(vehicleId, changeType, newValue) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return;

  try {
    const objId = new ObjectId(vehicleId);
    const vehicle = await db.collection("Vehicles").findOne({ _id: objId });
    if (!vehicle) return;

    const vehicleName = [vehicle.year, vehicle.make, vehicle.model]
      .filter(Boolean)
      .join(" ");

    // Find all watchers of this vehicle
    const watchers = await db
      .collection("WatchList")
      .find({ vehicle_id: objId })
      .toArray();
    if (!watchers.length) return;

    for (const watcher of watchers) {
      if (changeType === "price") {
        if (!watcher.target_price || newValue > watcher.target_price) continue;
      }

      // Save email notification (acts as dedup marker for the polling loop)
      const notifType = changeType === "price" ? "price_drop" : "car_available";
      const notifMessage =
        changeType === "price"
          ? `Price alert! ${vehicleName} is now $${Number(newValue).toFixed(2)}/day — at or below your target of $${Number(watcher.target_price).toFixed(2)}/day.`
          : `Good news! ${vehicleName} is now available for rental.`;
      await db.collection("Notifications").insertOne({
        username: watcher.username,
        type: notifType,
        message: notifMessage,
        link: "/vehicle-reservation.html",
        vehicle_id: objId,
        read: false,
        createdAt: new Date(),
      });

      console.log(
        `[WatchList] Notified ${watcher.username} (${changeType}) for vehicle ${vehicleId}`,
      );
    }
  } catch (err) {
    console.error("[WatchList] notifyWatchers error:", err.message);
  }
}

// ADD TO WATCHLIST
app.post("/api/watch", requireLogin, async (req, res) => {
  try {
    const { vehicle_id, target_price, start_date, end_date } = req.body;
    if (!vehicle_id || !ObjectId.isValid(vehicle_id)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }

    const username = req.session.user.username;

    // Check if already watching this exact vehicle
    const existing = await db.collection("WatchList").findOne({
      username,
      vehicle_id: new ObjectId(vehicle_id),
    });
    if (existing) {
      return res.json({ success: true, alreadyWatching: true });
    }

    await db.collection("WatchList").deleteMany({ username });

    await db.collection("WatchList").insertOne({
      username,
      vehicle_id: new ObjectId(vehicle_id),
      target_price: target_price ? Number(target_price) : null,
      start_date: start_date || null,
      end_date: end_date || null,
      created_at: new Date(),
    });

    // Save email notification + send watch confirmation email (Observer pattern)
    try {
      const [user, vehicle] = await Promise.all([
        db
          .collection("RentalUsers")
          .findOne(
            { username },
            { projection: { email: 1, fname: 1, lname: 1 } },
          ),
        db.collection("Vehicles").findOne({ _id: new ObjectId(vehicle_id) }),
      ]);

      if (vehicle) {
        const vehicleName =
          [vehicle.year, vehicle.make, vehicle.model]
            .filter(Boolean)
            .join(" ") || "Your Vehicle";
        await db.collection("Notifications").insertOne({
          username,
          type: "watch_confirmed",
          message: `You are now watching ${vehicleName}. We'll notify you when it becomes available${target_price ? ` or the price drops below $${Number(target_price).toFixed(2)}/day` : ""}.`,
          link: "/vehicle-reservation.html",
          vehicle_id: new ObjectId(vehicle_id),
          read: false,
          createdAt: new Date(),
        });

        if (user?.email && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
          const displayName =
            [user.fname, user.lname].filter(Boolean).join(" ") || username;
          const rate = vehicle.rental_rate_per_day
            ? `$${Number(vehicle.rental_rate_per_day).toFixed(2)}/day`
            : "N/A";
          const priceNote = target_price
            ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">We'll also notify you if the price drops below <strong>$${Number(target_price).toFixed(2)}/day</strong>.</p>`
            : "";
          const datesNote =
            start_date && end_date
              ? `<p style="margin:12px 0 0;font-size:14px;color:#444;">
                <span style="font-weight:bold;">Requested dates:</span><br>
                <span style="color:#ea8900;font-weight:bold;">Pick up:</span> ${start_date} &nbsp;&nbsp;
                <span style="color:#ea8900;font-weight:bold;">Drop off:</span> ${end_date}
               </p>`
              : "";
          const appUrl = process.env.APP_URL || "http://localhost:3000";
          await mailer.sendMail({
            from: `"DriveShare" <${process.env.GMAIL_USER}>`,
            to: user.email,
            subject: `You're watching ${vehicleName} on DriveShare`,
            html: `
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;">
                <tr>
                  <td bgcolor="#ea8900" style="padding:18px 24px;">
                    <h2 style="color:#ffffff;margin:0;font-size:18px;font-weight:bold;">Watch Confirmed</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px;font-size:15px;color:#222;">Hi <strong>${displayName}</strong>,</p>
                    <p style="margin:0 0 12px;font-size:14px;color:#444;">You're now watching:</p>
                    <p style="margin:0 0 4px;font-size:20px;font-weight:bold;color:#1a1a1a;">${vehicleName}</p>
                    <p style="margin:0 0 16px;font-size:14px;color:#888;">Current rate: ${rate}</p>
                    ${priceNote}
                    ${datesNote}
                    <p style="margin:16px 0 0;font-size:14px;color:#444;">We'll email you as soon as this vehicle becomes available or the price changes.</p>
                    <p style="margin:20px 0 0;">
                      <a href="${appUrl}/account.html#watchlist" target="_blank"
                        style="background:#ea8900;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
                        View Watchlist
                      </a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 24px;background:#f9f9f9;border-top:1px solid #eee;">
                    <p style="margin:0;font-size:11px;color:#aaa;">You received this because you added a vehicle to your watchlist on DriveShare.</p>
                  </td>
                </tr>
              </table>`,
          });
        }
      }
    } catch (err) {
      console.error(
        "[Watch] Confirmation notification/email error:",
        err.message,
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Watch error:", err);
    res.status(500).json({ error: "Failed to watch vehicle" });
  }
});

// GET WATCHLIST (with vehicle details joined in)
app.get("/api/watch", requireLogin, async (req, res) => {
  try {
    const list = await db
      .collection("WatchList")
      .find({
        username: req.session.user.username,
      })
      .toArray();

    // Enrich each entry with current vehicle data
    const enriched = await Promise.all(
      list.map(async (entry) => {
        const vehicle = await db.collection("Vehicles").findOne(
          { _id: entry.vehicle_id },
          {
            projection: {
              year: 1,
              make: 1,
              model: 1,
              rental_rate_per_day: 1,
              availability: 1,
              image_url: 1,
            },
          },
        );
        return {
          _id: entry._id,
          vehicle_id: entry.vehicle_id,
          target_price: entry.target_price,
          start_date: entry.start_date || null,
          end_date: entry.end_date || null,
          created_at: entry.created_at,
          vehicle: vehicle
            ? {
                label: [vehicle.year, vehicle.make, vehicle.model]
                  .filter(Boolean)
                  .join(" "),
                rental_rate_per_day: vehicle.rental_rate_per_day ?? null,
                availability: vehicle.availability ?? false,
                image_url: vehicle.image_url ?? "",
              }
            : null,
        };
      }),
    );

    res.json(enriched);
  } catch (err) {
    console.error("Get watchlist error:", err);
    res.status(500).json({ error: "Failed to load watchlist" });
  }
});

// REMOVE FROM WATCHLIST
app.delete("/api/watch", requireLogin, async (req, res) => {
  try {
    const { vehicle_id } = req.body;
    if (!vehicle_id || !ObjectId.isValid(vehicle_id)) {
      return res.status(400).json({ error: "Invalid vehicle ID" });
    }
    await db.collection("WatchList").deleteOne({
      username: req.session.user.username,
      vehicle_id: new ObjectId(vehicle_id),
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Unwatch error:", err);
    res.status(500).json({ error: "Failed to remove watch" });
  }
});

// SEND MESSAGE
app.post("/api/messages", requireLogin, async (req, res) => {
  try {
    const { to, message, vehicle_id } = req.body;

    await db.collection("Messages").insertOne({
      from: req.session.user.username,
      to,
      vehicle_id: new ObjectId(vehicle_id),
      message,
      timestamp: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// GET MESSAGES
app.get("/api/messages", requireLogin, async (req, res) => {
  const messages = await db
    .collection("Messages")
    .find({
      $or: [
        { from: req.session.user.username },
        { to: req.session.user.username },
      ],
    })
    .toArray();

  res.json(messages);
});

// ── Host Reviews ────────────────────────────────────────────
// GET /api/reviews/by-reservation/:id  — customer review for a given reservation (host view)
app.get("/api/reviews/by-reservation/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid reservation ID" });
    }
    const review = await db
      .collection("Reviews")
      .findOne({ reservation_id: new ObjectId(id) });

    if (!review) {
      return res
        .status(404)
        .json({ error: "No customer review found for this reservation" });
    }
    res.json(serializeReview(review));
  } catch (err) {
    console.error("reviews/by-reservation error:", err);
    res.status(500).json({ error: "Failed to fetch review" });
  }
});

// DELETE /api/reviews/:id  — host deletes a customer's review of their vehicle
app.delete("/api/reviews/:id", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid review ID" });
    }

    // Verify the review is for one of this host's vehicles
    const review = await db
      .collection("Reviews")
      .findOne({ _id: new ObjectId(id) });
    if (!review) return res.status(404).json({ error: "Review not found" });

    const vehicle = await db
      .collection("Vehicles")
      .findOne({ _id: review.vehicle_id, host_username: hostUsername });

    if (!vehicle) {
      return res.status(403).json({ error: "Not your vehicle" });
    }

    await db.collection("Reviews").deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/reviews/:id error:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// GET /api/host-reviews/for-customer  — reviews written about the logged-in customer
app.get("/api/host-reviews/for-customer", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const reviews = await db
      .collection("HostReviews")
      .find({ customer_username: username })
      .sort({ created_at: -1 })
      .toArray();

    res.json(
      reviews.map((r) => ({
        _id: r._id.toString(),
        vehicle_name: r.vehicle_name || "—",
        host_username: r.host_username || "—",
        rating: r.rating,
        comment: r.comment || "",
        start_date: r.start_date || "",
        end_date: r.end_date || "",
        created_at: r.created_at || "",
      })),
    );
  } catch (err) {
    console.error("host-reviews/for-customer error:", err);
    res.status(500).json({ error: "Failed to load owner reviews" });
  }
});

// GET /api/host-reviews  — reviews written + pending
app.get("/api/host-reviews", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;

    // Vehicles owned by this host
    const vehicles = await db
      .collection("Vehicles")
      .find({ host_username: hostUsername })
      .toArray();

    const vehicleIds = vehicles.map((v) => v._id);
    const vehicleMap = {};
    vehicles.forEach((v) => {
      vehicleMap[v._id.toString()] = v;
    });

    const allReservations = await db
      .collection("Reservations")
      .find({ status: "Complete" })
      .sort({ end_date: -1 })
      .toArray();

    const completed = allReservations.filter((r) =>
      toIdArray(r.history_vehicle_id).some((id) =>
        vehicleIds.some((vid) => vid.toString() === id.toString()),
      ),
    );

    const existing = await db
      .collection("HostReviews")
      .find({ host_username: hostUsername })
      .sort({ created_at: -1 })
      .toArray();

    const reviewedResIds = new Set(
      existing.map((r) => r.reservation_id.toString()),
    );

    const userIds = [
      ...new Set(completed.map((r) => r.user_id?.toString()).filter(Boolean)),
    ].map((id) => new ObjectId(id));

    const renters = await db
      .collection("RentalUsers")
      .find({ _id: { $in: userIds } })
      .toArray();

    const renterMap = {};
    renters.forEach((u) => {
      renterMap[u._id.toString()] = u;
    });

    // Build pending list
    const pending = completed
      .filter((r) => !reviewedResIds.has(r._id.toString()))
      .map((r) => {
        const vehicleId = toIdArray(r.history_vehicle_id)[0];
        const vehicle = vehicleId ? vehicleMap[vehicleId.toString()] : null;
        const renter = r.user_id ? renterMap[r.user_id.toString()] : null;
        return {
          reservation_id: r._id.toString(),
          order_id: r.orderId || "N/A",
          vehicle_id: vehicleId ? vehicleId.toString() : "",
          vehicle_name: getVehicleLabel(vehicle),
          customer_username: renter?.username || r.customer_name || "—",
          customer_name: renter
            ? [renter.fname, renter.lname].filter(Boolean).join(" ") ||
              renter.username
            : r.customer_name || "—",
          start_date: r.start_date || "",
          end_date: r.end_date || "",
        };
      });

    // Build written reviews list
    const written = existing.map((rev) => ({
      _id: rev._id.toString(),
      reservation_id: rev.reservation_id.toString(),
      vehicle_id: rev.vehicle_id ? rev.vehicle_id.toString() : "",
      vehicle_name: rev.vehicle_name || "—",
      customer_name: rev.customer_name || "—",
      customer_username: rev.customer_username || "—",
      rating: rev.rating,
      comment: rev.comment || "",
      start_date: rev.start_date || "",
      end_date: rev.end_date || "",
      created_at: rev.created_at || "",
    }));

    res.json({ written, pending });
  } catch (err) {
    console.error("host-reviews GET error:", err);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

// POST /api/host-reviews  — write a new review
app.post("/api/host-reviews", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;
    const { reservation_id, rating, comment } = req.body;

    if (!reservation_id || !rating || !comment) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: "Rating must be 1–5" });
    }
    if (!ObjectId.isValid(reservation_id)) {
      return res.status(400).json({ error: "Invalid reservation ID" });
    }

    const reservation = await db
      .collection("Reservations")
      .findOne({ _id: new ObjectId(reservation_id), status: "Complete" });

    if (!reservation) {
      return res.status(404).json({ error: "Completed reservation not found" });
    }

    const vehicleId = toIdArray(reservation.history_vehicle_id)[0];
    if (!vehicleId) {
      return res
        .status(400)
        .json({ error: "Vehicle not found on reservation" });
    }
    const vehicle = await db
      .collection("Vehicles")
      .findOne({ _id: new ObjectId(vehicleId), host_username: hostUsername });

    if (!vehicle) {
      return res.status(403).json({ error: "Not your vehicle" });
    }

    const existing = await db.collection("HostReviews").findOne({
      reservation_id: reservation._id,
      host_username: hostUsername,
    });

    if (existing) {
      return res.status(409).json({ error: "Already reviewed this rental" });
    }

    const renter = reservation.user_id
      ? await db
          .collection("RentalUsers")
          .findOne({ _id: new ObjectId(reservation.user_id) })
      : null;

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const doc = {
      reservation_id: reservation._id,
      vehicle_id: new ObjectId(vehicleId),
      vehicle_name: getVehicleLabel(vehicle),
      host_username: hostUsername,
      customer_username: renter?.username || reservation.customer_name || "—",
      customer_name: renter
        ? [renter.fname, renter.lname].filter(Boolean).join(" ") ||
          renter.username
        : reservation.customer_name || "—",
      start_date: reservation.start_date || "",
      end_date: reservation.end_date || "",
      rating: numRating,
      comment: String(comment).trim(),
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection("HostReviews").insertOne(doc);
    res.status(201).json({
      success: true,
      review: {
        ...doc,
        _id: result.insertedId.toString(),
        reservation_id: doc.reservation_id.toString(),
        vehicle_id: doc.vehicle_id.toString(),
      },
    });
  } catch (err) {
    console.error("host-reviews POST error:", err);
    res.status(500).json({ error: "Failed to save review" });
  }
});

// PUT /api/host-reviews/:id  — edit a review
app.put("/api/host-reviews/:id", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid review ID" });
    }
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: "Rating must be 1–5" });
    }
    if (!comment) {
      return res.status(400).json({ error: "Comment is required" });
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const result = await db.collection("HostReviews").updateOne(
      { _id: new ObjectId(id), host_username: hostUsername },
      {
        $set: {
          rating: numRating,
          comment: String(comment).trim(),
          updated_at: now,
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("host-reviews PUT error:", err);
    res.status(500).json({ error: "Failed to update review" });
  }
});

// DELETE /api/host-reviews/:id
app.delete("/api/host-reviews/:id", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid review ID" });
    }
    const result = await db
      .collection("HostReviews")
      .deleteOne({ _id: new ObjectId(id), host_username: hostUsername });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("host-reviews DELETE error:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// ── Send a message ──────────────────────────────────────────
app.post("/api/messages/send", requireLogin, async (req, res) => {
  try {
    const { to_username, subject, body, vehicle_id } = req.body;
    const from_username = req.session.user_name;

    if (!to_username || !body) {
      return res
        .status(400)
        .json({ error: "Recipient and message body are required." });
    }

    // Verify recipient exists (check both RentalUsers and HostUsers)
    const recipient =
      (await db.collection("RentalUsers").findOne({ username: to_username })) ||
      (await db.collection("HostUsers").findOne({ username: to_username }));

    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found." });
    }

    const message = {
      from_username,
      to_username,
      subject: subject || "(no subject)",
      body,
      vehicle_id: vehicle_id || null,
      read: false,
      createdAt: new Date(),
    };

    const result = await db.collection("Messages").insertOne(message);

    // Send email notification to recipient if they have an email
    if (recipient.email && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        await mailer.sendMail({
          from: `"DriveShare" <${process.env.GMAIL_USER}>`,
          to: recipient.email,
          subject: `New message from ${from_username} — ${message.subject}`,
          html: `
            <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
              <div style="background:#e8604c; padding:16px 24px;">
                <h2 style="color:#fff; margin:0; font-size:18px;">New Message on DriveShare</h2>
              </div>
              <div style="padding:24px;">
                <p style="margin:0 0 8px;"><strong>From:</strong> ${from_username}</p>
                <p style="margin:0 0 8px;"><strong>Subject:</strong> ${message.subject}</p>
                <hr style="border:none; border-top:1px solid #eee; margin:16px 0;">
                <p style="color:#333; line-height:1.6;">${body.replace(/\n/g, "<br>")}</p>
                <hr style="border:none; border-top:1px solid #eee; margin:16px 0;">
                <p style="color:#888; font-size:12px;">
                  Log in to <a href="https://driveshare-6b05ff2378e7.herokuapp.com" style="color:#e8604c;">DriveShare</a> to reply.
                </p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Message email notification failed:", emailErr.message);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, messageId: result.insertedId });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// ── Get inbox (messages TO the logged-in user) ──────────────
app.get("/api/messages/inbox", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const messages = await db
      .collection("Messages")
      .find({ to_username: username })
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich with vehicle info if present
    const enriched = await Promise.all(
      messages.map(async (m) => {
        let vehicleLabel = null;
        if (m.vehicle_id && ObjectId.isValid(m.vehicle_id)) {
          const v = await db
            .collection("Vehicles")
            .findOne({ _id: new ObjectId(m.vehicle_id) });
          if (v)
            vehicleLabel = [v.year, v.make, v.model].filter(Boolean).join(" ");
        }
        return { ...m, vehicleLabel };
      }),
    );

    res.json(enriched);
  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).json({ error: "Failed to load inbox." });
  }
});

// ── Get sent messages (messages FROM the logged-in user) ────
app.get("/api/messages/sent", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const messages = await db
      .collection("Messages")
      .find({ from_username: username })
      .sort({ createdAt: -1 })
      .toArray();

    const enriched = await Promise.all(
      messages.map(async (m) => {
        let vehicleLabel = null;
        if (m.vehicle_id && ObjectId.isValid(m.vehicle_id)) {
          const v = await db
            .collection("Vehicles")
            .findOne({ _id: new ObjectId(m.vehicle_id) });
          if (v)
            vehicleLabel = [v.year, v.make, v.model].filter(Boolean).join(" ");
        }
        return { ...m, vehicleLabel };
      }),
    );

    res.json(enriched);
  } catch (err) {
    console.error("Sent messages error:", err);
    res.status(500).json({ error: "Failed to load sent messages." });
  }
});

// ── Mark message as read ────────────────────────────────────
app.patch("/api/messages/:id/read", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid ID." });
    await db
      .collection("Messages")
      .updateOne({ _id: new ObjectId(id) }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read." });
  }
});

// ── Unread count (for notification badge) ───────────────────
app.get("/api/messages/unread-count", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const count = await db
      .collection("Messages")
      .countDocuments({ to_username: username, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ count: 0 });
  }
});

// ── Get host username for a vehicle (so renter can message them) ──
app.get("/api/vehicle/:id/host", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid vehicle ID." });
    const vehicle = await db
      .collection("Vehicles")
      .findOne({ _id: new ObjectId(id) });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found." });
    res.json({ host_username: vehicle.host_username });
  } catch (err) {
    res.status(500).json({ error: "Failed to get host info." });
  }
});

//  OBSERVER PATTERN API Routes
app.post("/api/watchlist", requireLogin, async (req, res) => {
  try {
    const { vehicleId, maxPrice } = req.body;
    const username = req.session.user_name;

    if (!vehicleId || !ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID." });
    }

    // Remove existing watch for this vehicle first (upsert behavior)
    await db.collection("WatchList").deleteOne({
      username,
      vehicle_id: new ObjectId(vehicleId),
    });

    // Add new watch entry
    await db.collection("WatchList").insertOne({
      username,
      vehicle_id: new ObjectId(vehicleId),
      target_price: maxPrice ? Number(maxPrice) : null,
      notify_available: true,
      createdAt: new Date(),
    });

    console.log(`[Observer] ${username} is now watching vehicle ${vehicleId}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Watchlist error:", err);
    res.status(500).json({ error: "Failed to watch vehicle." });
  }
});

// ── Get current user's watchlist ─────────────────────────────
app.get("/api/watchlist", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const list = await db.collection("WatchList").find({ username }).toArray();

    // Enrich with vehicle details
    const enriched = await Promise.all(
      list.map(async (w) => {
        const v = await db
          .collection("Vehicles")
          .findOne({ _id: w.vehicle_id });
        return {
          ...w,
          vehicle: v
            ? {
                label: [v.year, v.make, v.model].filter(Boolean).join(" "),
                price: v.rental_rate_per_day,
                availability: v.availability,
                image_url: v.image_url || "",
              }
            : null,
        };
      }),
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to get watchlist." });
  }
});

// Remove from watchlist
app.delete("/api/watchlist/:vehicleId", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const { vehicleId } = req.params;

    if (!ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID." });
    }

    await db.collection("WatchList").deleteOne({
      username,
      vehicle_id: new ObjectId(vehicleId),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove from watchlist." });
  }
});

// Get notifications for logged-in user
app.get("/api/notifications", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const notifications = await db
      .collection("Notifications")
      .find({ username })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to get notifications." });
  }
});

//  Mark notification as read
app.patch("/api/notifications/:id/read", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid ID." });

    await db
      .collection("Notifications")
      .updateOne({ _id: new ObjectId(id) }, { $set: { read: true } });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read." });
  }
});

//  Unread notification count
app.get("/api/notifications/unread-count", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;
    const count = await db
      .collection("Notifications")
      .countDocuments({ username, read: false });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ count: 0 });
  }
});
// Returns the logged-in user's completed reservations that have not already been reviewed, along with their vehicle details.
app.get("/api/reviews/reviewable", requireLogin, async (req, res) => {
  try {
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });

    if (!user) return res.status(404).json({ error: "User not found" });

    const completeReservations = await db
      .collection("Reservations")
      .find({ user_id: user._id, status: "Complete" })
      .sort({ updated_at: -1, end_date: -1 })
      .toArray();

    if (!completeReservations.length) return res.json([]);

    const existingReviews = await db
      .collection("Reviews")
      .find({ user_id: user._id }, { projection: { reservation_id: 1 } })
      .toArray();

    const reviewedReservationIds = new Set(
      existingReviews.map((r) => r.reservation_id.toString()),
    );

    const vehicleIds = [
      ...new Set(
        completeReservations
          .map((r) =>
            normalizeObjectId(
              toIdArray(r.history_vehicle_id || r.vehicle_id)[0],
            ),
          )
          .filter(Boolean)
          .map((id) => id.toString()),
      ),
    ].map((id) => new ObjectId(id));

    const vehicles = await db
      .collection("Vehicles")
      .find({ _id: { $in: vehicleIds } })
      .toArray();

    const vehicleMap = {};
    vehicles.forEach((v) => {
      vehicleMap[v._id.toString()] = v;
    });

    const result = completeReservations
      .filter((r) => !reviewedReservationIds.has(r._id.toString()))
      .map((r) => {
        const vehicleId = normalizeObjectId(
          toIdArray(r.history_vehicle_id || r.vehicle_id)[0],
        );
        if (!vehicleId) return null;

        const vehicle = vehicleMap[vehicleId.toString()] || null;

        return {
          reservation_id: r._id.toString(),
          order_id: r.orderId || "N/A",
          vehicle_id: vehicleId.toString(),
          vehicle_name: getVehicleLabel(vehicle),
          end_date: r.end_date || "",
          location: r.location || "",
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    console.error("Reviewable rentals error:", err);
    res.status(500).json({ error: "Failed to fetch reviewable rentals" });
  }
});
// Returns the logged-in user's reviews, sorted by newest first, and formats them for the response.
app.get("/api/reviews/mine", requireLogin, async (req, res) => {
  try {
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });

    if (!user) return res.status(404).json({ error: "User not found" });

    const reviews = await db
      .collection("Reviews")
      .find({ user_id: user._id })
      .sort({ created_at: -1 })
      .toArray();

    res.json(reviews.map(serializeReview));
  } catch (err) {
    console.error("My reviews error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});
// Creates a review for a completed reservation after validating the user, rating, reservation, and duplicate review status.
app.post("/api/reviews", requireLogin, async (req, res) => {
  try {
    const { reservation_id, rating, title, body } = req.body;

    if (!reservation_id || !rating || !title || !body) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const numericRating = Number(rating);
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    if (!ObjectId.isValid(reservation_id)) {
      return res.status(400).json({ error: "Invalid reservation ID" });
    }

    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });

    if (!user) return res.status(404).json({ error: "User not found" });

    const reservation = await db.collection("Reservations").findOne({
      _id: new ObjectId(reservation_id),
      user_id: user._id,
      status: "Complete",
    });

    if (!reservation) {
      return res.status(404).json({
        error: "Only completed rentals can be reviewed",
      });
    }

    const existing = await db.collection("Reviews").findOne({
      reservation_id: reservation._id,
    });

    if (existing) {
      return res.status(409).json({
        error: "This completed rental has already been reviewed",
      });
    }

    const vehicleId = normalizeObjectId(
      toIdArray(reservation.history_vehicle_id || reservation.vehicle_id)[0],
    );

    if (!vehicleId) {
      return res
        .status(400)
        .json({ error: "Vehicle not found for reservation" });
    }

    const vehicle = await db.collection("Vehicles").findOne({ _id: vehicleId });

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    const reviewDoc = {
      reservation_id: reservation._id,
      order_id: reservation.orderId || null,
      vehicle_id: vehicleId,
      vehicle_name: getVehicleLabel(vehicle),
      user_id: user._id,
      username: user.username,
      customer_name: [user.fname, user.lname].filter(Boolean).join(" "),
      host_username: reservation.hostUsername || vehicle?.host_username || null,
      rating: numericRating,
      title: String(title).trim(),
      body: String(body).trim(),
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection("Reviews").insertOne(reviewDoc);

    res.status(201).json({
      success: true,
      review: serializeReview({
        ...reviewDoc,
        _id: result.insertedId,
      }),
    });
  } catch (err) {
    console.error("Create review error:", err);
    res.status(500).json({ error: "Failed to save review" });
  }
});
// Returns the logged-in user's completed reservations that still need a review, including related vehicle information.
app.get("/api/reviews/reviewable", requireLogin, async (req, res) => {
  try {
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });

    if (!user) return res.status(404).json({ error: "User not found" });

    const reservations = await db
      .collection("Reservations")
      .find({
        user_id: user._id,
        status: "Complete",
      })
      .sort({ updated_at: -1 })
      .toArray();

    const existingReviews = await db
      .collection("Reviews")
      .find({ user_id: user._id })
      .toArray();

    const reviewedReservationIds = new Set(
      existingReviews.map((r) => String(r.reservation_id)),
    );

    const vehicleIds = [
      ...new Set(
        reservations
          .map((r) => r.history_vehicle_id || r.vehicle_id)
          .filter(Boolean)
          .map((id) => String(id)),
      ),
    ].map((id) => new ObjectId(id));

    const vehicles = await db
      .collection("Vehicles")
      .find({ _id: { $in: vehicleIds } })
      .toArray();

    const vehicleMap = {};
    vehicles.forEach((v) => {
      vehicleMap[String(v._id)] =
        [v.year, v.make, v.model].filter(Boolean).join(" ") ||
        "Unknown Vehicle";
    });

    const result = reservations
      .filter((r) => !reviewedReservationIds.has(String(r._id)))
      .map((r) => {
        const vehicleId = String(r.history_vehicle_id || r.vehicle_id || "");
        return {
          reservation_id: String(r._id),
          order_id: r.orderId,
          vehicle_id: vehicleId,
          vehicle_name: vehicleMap[vehicleId] || "Unknown Vehicle",
          end_date: r.end_date,
          location: r.location,
        };
      });

    res.json(result);
  } catch (err) {
    console.error("reviewable route error:", err);
    res.status(500).json({ error: "Failed to load completed rentals" });
  }
});
// Returns all reviews written by the logged-in user, sorted newest first, with ObjectIds converted to strings.
app.get("/api/reviews/mine", requireLogin, async (req, res) => {
  try {
    const user = await db
      .collection("RentalUsers")
      .findOne({ username: req.session.user_name });

    if (!user) return res.status(404).json({ error: "User not found" });

    const reviews = await db
      .collection("Reviews")
      .find({ user_id: user._id })
      .sort({ created_at: -1 })
      .toArray();

    res.json(
      reviews.map((r) => ({
        ...r,
        _id: String(r._id),
        reservation_id: String(r.reservation_id),
        vehicle_id: String(r.vehicle_id),
        user_id: String(r.user_id),
      })),
    );
  } catch (err) {
    console.error("mine route error:", err);
    res.status(500).json({ error: "Failed to load your reviews" });
  }
});
// Creates a new review for a completed reservation if it belongs to the logged-in user and has not already been reviewed.
// ── Host Chat: eligible renters (active reservations, not Complete/Cancelled) ──
app.get("/api/host/eligible-renters", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;

    const vehicles = await db
      .collection("Vehicles")
      .find(
        { host_username: hostUsername },
        { projection: { _id: 1, year: 1, make: 1, model: 1 } },
      )
      .toArray();

    if (!vehicles.length) return res.json([]);

    const vehicleIds = vehicles.map((v) => v._id);
    const vehicleMap = {};
    vehicles.forEach((v) => {
      vehicleMap[String(v._id)] = [v.year, v.make, v.model]
        .filter(Boolean)
        .join(" ");
    });

    const activeReservations = await db
      .collection("Reservations")
      .find({
        status: { $nin: ["Complete", "Cancelled"] },
        $or: [
          { history_vehicle_id: { $in: vehicleIds } },
          { vehicle_id: { $in: vehicleIds } },
        ],
      })
      .toArray();

    if (!activeReservations.length) return res.json([]);

    // Look up renter usernames via user_id
    const userIds = [
      ...new Set(
        activeReservations
          .map((r) => r.user_id)
          .filter((id) => id && ObjectId.isValid(String(id)))
          .map((id) => String(id)),
      ),
    ];
    const renterUsers = await db
      .collection("RentalUsers")
      .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } })
      .toArray();
    const userMap = {};
    renterUsers.forEach((u) => {
      userMap[String(u._id)] = u;
    });

    const seen = new Set();
    const result = [];
    for (const r of activeReservations) {
      const vehicleId = String(r.history_vehicle_id || r.vehicle_id || "");
      const renterUser = r.user_id ? userMap[String(r.user_id)] : null;
      const renterUsername = renterUser?.username || null;
      if (!renterUsername || !vehicleId) continue;
      const key = `${renterUsername}::${vehicleId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        renter_username: renterUsername,
        renter_name: r.customer_name || renterUsername,
        vehicle_id: vehicleId,
        vehicle_label: vehicleMap[vehicleId] || "Vehicle",
        reservation_status: r.status,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("eligible-renters error:", err);
    res.status(500).json({ error: "Failed to load eligible renters." });
  }
});

// ── Host Chat: get all threads for this host ─────────────────────────────────
app.get("/api/host/chat-threads", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;

    const messages = await db
      .collection("Messages")
      .find({
        $or: [{ from_username: hostUsername }, { to_username: hostUsername }],
      })
      .sort({ createdAt: -1 })
      .toArray();

    if (!messages.length) return res.json([]);

    const threadMap = {};
    for (const m of messages) {
      const otherParty =
        m.from_username === hostUsername ? m.to_username : m.from_username;
      const vehicleId = m.vehicle_id ? String(m.vehicle_id) : "general";
      const key = `${otherParty}::${vehicleId}`;

      if (!threadMap[key]) {
        threadMap[key] = {
          renter_username: otherParty,
          vehicle_id: vehicleId === "general" ? null : vehicleId,
          vehicle_label: null,
          last_message: m.body || m.message || "",
          last_message_time: m.createdAt || m.timestamp,
          unread_count: 0,
        };
      }
      if (m.to_username === hostUsername && !m.read) {
        threadMap[key].unread_count++;
      }
    }

    const vehicleIds = [
      ...new Set(
        Object.values(threadMap)
          .map((t) => t.vehicle_id)
          .filter(Boolean),
      ),
    ];
    if (vehicleIds.length) {
      const vehicles = await db
        .collection("Vehicles")
        .find({ _id: { $in: vehicleIds.map((id) => new ObjectId(id)) } })
        .toArray();
      vehicles.forEach((v) => {
        const label = [v.year, v.make, v.model].filter(Boolean).join(" ");
        Object.values(threadMap).forEach((t) => {
          if (t.vehicle_id === String(v._id)) t.vehicle_label = label;
        });
      });
    }

    const threads = Object.values(threadMap).sort(
      (a, b) => new Date(b.last_message_time) - new Date(a.last_message_time),
    );
    res.json(threads);
  } catch (err) {
    console.error("chat-threads error:", err);
    res.status(500).json({ error: "Failed to load chat threads." });
  }
});

// ── Host Chat: get messages for a specific thread ────────────────────────────
app.get("/api/host/chat-messages", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;
    const { renter_username, vehicle_id } = req.query;

    if (!renter_username)
      return res.status(400).json({ error: "renter_username is required." });

    const baseQuery = {
      $or: [
        { from_username: hostUsername, to_username: renter_username },
        { from_username: renter_username, to_username: hostUsername },
      ],
    };

    if (vehicle_id && ObjectId.isValid(vehicle_id)) {
      baseQuery.vehicle_id = new ObjectId(vehicle_id);
    } else {
      baseQuery.vehicle_id = { $in: [null, undefined] };
    }

    const messages = await db
      .collection("Messages")
      .find(baseQuery)
      .sort({ createdAt: 1, timestamp: 1 })
      .toArray();

    await db
      .collection("Messages")
      .updateMany(
        { ...baseQuery, to_username: hostUsername, read: false },
        { $set: { read: true } },
      );

    res.json(
      messages.map((m) => ({
        _id: String(m._id),
        from_username: m.from_username,
        to_username: m.to_username,
        body: m.body || m.message || "",
        vehicle_id: m.vehicle_id ? String(m.vehicle_id) : null,
        read: m.read || false,
        createdAt: m.createdAt || m.timestamp,
      })),
    );
  } catch (err) {
    console.error("chat-messages error:", err);
    res.status(500).json({ error: "Failed to load messages." });
  }
});

// ── Host Chat: send a message ─────────────────────────────────────────────────
app.post("/api/host/chat-send", requireLogin, async (req, res) => {
  try {
    const hostUsername = req.session.user_name;
    const { to_username, body, vehicle_id } = req.body;

    if (!to_username || !body || !body.trim()) {
      return res
        .status(400)
        .json({ error: "Recipient and message are required." });
    }

    if (vehicle_id && ObjectId.isValid(vehicle_id)) {
      const vehicle = await db.collection("Vehicles").findOne({
        _id: new ObjectId(vehicle_id),
        host_username: hostUsername,
      });
      if (!vehicle)
        return res.status(403).json({ error: "You do not own this vehicle." });
    }

    const msg = {
      from_username: hostUsername,
      to_username,
      body: body.trim(),
      subject: "(chat)",
      vehicle_id:
        vehicle_id && ObjectId.isValid(vehicle_id)
          ? new ObjectId(vehicle_id)
          : null,
      read: false,
      createdAt: new Date(),
    };

    const result = await db.collection("Messages").insertOne(msg);
    res.json({ success: true, messageId: String(result.insertedId) });
  } catch (err) {
    console.error("host chat-send error:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// ── Renter Chat: all hosts & their vehicles (for "new chat" panel) ────────────
app.get("/api/renter/all-hosts-vehicles", requireLogin, async (req, res) => {
  try {
    const vehicles = await db
      .collection("Vehicles")
      .find(
        { host_username: { $exists: true, $ne: null } },
        {
          projection: { _id: 1, year: 1, make: 1, model: 1, host_username: 1 },
        },
      )
      .toArray();

    const result = vehicles.map((v) => ({
      vehicle_id: String(v._id),
      vehicle_label: [v.year, v.make, v.model].filter(Boolean).join(" "),
      host_username: v.host_username,
    }));

    res.json(result);
  } catch (err) {
    console.error("renter all-hosts-vehicles error:", err);
    res.status(500).json({ error: "Failed to load hosts and vehicles." });
  }
});

// ── Renter Chat: get all threads for this renter ──────────────────────────────
app.get("/api/renter/chat-threads", requireLogin, async (req, res) => {
  try {
    const renterUsername = req.session.user_name;
    const threadMap = {};

    // Pre-populate with active (non-complete, non-cancelled) reservations
    const activeReservations = await db
      .collection("Reservations")
      .find({
        customer_username: renterUsername,
        status: { $nin: ["Complete", "Cancelled"] },
      })
      .toArray();

    for (const r of activeReservations) {
      const vehicleId = String(r.history_vehicle_id || r.vehicle_id || "");
      if (!vehicleId || !ObjectId.isValid(vehicleId)) continue;
      const vehicle = await db
        .collection("Vehicles")
        .findOne({ _id: new ObjectId(vehicleId) });
      if (!vehicle || !vehicle.host_username) continue;
      const key = `${vehicle.host_username}::${vehicleId}`;
      if (!threadMap[key]) {
        threadMap[key] = {
          host_username: vehicle.host_username,
          vehicle_id: vehicleId,
          vehicle_label: [vehicle.year, vehicle.make, vehicle.model]
            .filter(Boolean)
            .join(" "),
          last_message: "",
          last_message_time: r.createdAt || new Date(0),
          unread_count: 0,
        };
      }
    }

    // Overlay with actual message history
    const messages = await db
      .collection("Messages")
      .find({
        $or: [
          { from_username: renterUsername },
          { to_username: renterUsername },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();

    for (const m of messages) {
      const otherParty =
        m.from_username === renterUsername ? m.to_username : m.from_username;
      const vehicleId = m.vehicle_id ? String(m.vehicle_id) : "general";
      const key = `${otherParty}::${vehicleId}`;
      if (!threadMap[key]) {
        threadMap[key] = {
          host_username: otherParty,
          vehicle_id: vehicleId === "general" ? null : vehicleId,
          vehicle_label: null,
          last_message: m.body || m.message || "",
          last_message_time: m.createdAt || m.timestamp,
          unread_count: 0,
        };
      } else {
        if (!threadMap[key].last_message) {
          threadMap[key].last_message = m.body || m.message || "";
          threadMap[key].last_message_time = m.createdAt || m.timestamp;
        }
      }
      if (m.to_username === renterUsername && !m.read) {
        threadMap[key].unread_count++;
      }
    }

    // Fetch vehicle labels for threads missing them
    const vehicleIds = [
      ...new Set(
        Object.values(threadMap)
          .map((t) => t.vehicle_id)
          .filter(Boolean),
      ),
    ];
    if (vehicleIds.length) {
      const vehicles = await db
        .collection("Vehicles")
        .find({ _id: { $in: vehicleIds.map((id) => new ObjectId(id)) } })
        .toArray();
      vehicles.forEach((v) => {
        const label = [v.year, v.make, v.model].filter(Boolean).join(" ");
        Object.values(threadMap).forEach((t) => {
          if (t.vehicle_id === String(v._id) && !t.vehicle_label)
            t.vehicle_label = label;
        });
      });
    }

    const threads = Object.values(threadMap).sort(
      (a, b) => new Date(b.last_message_time) - new Date(a.last_message_time),
    );
    res.json(threads);
  } catch (err) {
    console.error("renter chat-threads error:", err);
    res.status(500).json({ error: "Failed to load chat threads." });
  }
});

// ── Renter Chat: get messages for a specific thread ───────────────────────────
app.get("/api/renter/chat-messages", requireLogin, async (req, res) => {
  try {
    const renterUsername = req.session.user_name;
    const { host_username, vehicle_id } = req.query;

    if (!host_username)
      return res.status(400).json({ error: "host_username is required." });

    const baseQuery = {
      $or: [
        { from_username: renterUsername, to_username: host_username },
        { from_username: host_username, to_username: renterUsername },
      ],
    };

    if (vehicle_id && ObjectId.isValid(vehicle_id)) {
      baseQuery.vehicle_id = new ObjectId(vehicle_id);
    } else {
      baseQuery.vehicle_id = { $in: [null, undefined] };
    }

    const messages = await db
      .collection("Messages")
      .find(baseQuery)
      .sort({ createdAt: 1, timestamp: 1 })
      .toArray();

    // Mark messages sent to this renter as read
    await db
      .collection("Messages")
      .updateMany(
        { ...baseQuery, to_username: renterUsername, read: false },
        { $set: { read: true } },
      );

    res.json(
      messages.map((m) => ({
        _id: String(m._id),
        from_username: m.from_username,
        to_username: m.to_username,
        body: m.body || m.message || "",
        vehicle_id: m.vehicle_id ? String(m.vehicle_id) : null,
        read: m.read || false,
        createdAt: m.createdAt || m.timestamp,
      })),
    );
  } catch (err) {
    console.error("renter chat-messages error:", err);
    res.status(500).json({ error: "Failed to load messages." });
  }
});

// ── Renter Chat: send a message ───────────────────────────────────────────────
app.post("/api/renter/chat-send", requireLogin, async (req, res) => {
  try {
    const renterUsername = req.session.user_name;
    const { to_username, body, vehicle_id } = req.body;

    if (!to_username || !body || !body.trim()) {
      return res
        .status(400)
        .json({ error: "Recipient and message are required." });
    }

    const msg = {
      from_username: renterUsername,
      to_username,
      body: body.trim(),
      subject: "(chat)",
      vehicle_id:
        vehicle_id && ObjectId.isValid(vehicle_id)
          ? new ObjectId(vehicle_id)
          : null,
      read: false,
      createdAt: new Date(),
    };

    const result = await db.collection("Messages").insertOne(msg);
    res.json({ success: true, messageId: String(result.insertedId) });
  } catch (err) {
    console.error("renter chat-send error:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
});
