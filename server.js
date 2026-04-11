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

async function sendReservationEmail(
  to,
  reservation,
  vehicle,
  last4,
  baseUrl,
  username,
) {
  // Save in-app notification (Observer pattern — same as notifyWatchers)
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
const dbname = "DriveShare";

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
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed!"), false);
  },
});

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
// this is the singleton pattern for managing user sessions
const SessionManagerSingleton = (() => {
  let instance = null;
  function createInstance() {
    return {
      activeSessions: new Map(),
      addSession(username, sessionId) {
        this.activeSessions.set(username, sessionId);
        console.log(`[SessionManager] Session started: ${username}`);
      },
      removeSession(username) {
        this.activeSessions.delete(username);
        console.log(`[SessionManager] Session ended: ${username}`);
      },
      isActive(username) {
        return this.activeSessions.has(username);
      },
    };
  }
  return {
    getInstance() {
      if (!instance) {
        instance = createInstance();
        console.log("[SessionManager] Singleton instance created.");
      }
      return instance;
    },
  };
})();
const sessionManager = SessionManagerSingleton.getInstance();

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
      { question: security1, answer: (answer1 || "").trim().toLowerCase() },
      { question: security2, answer: (answer2 || "").trim().toLowerCase() },
      { question: security3, answer: (answer3 || "").trim().toLowerCase() },
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
        { question: security1, answer: (answer1 || "").trim().toLowerCase() },
        { question: security2, answer: (answer2 || "").trim().toLowerCase() },
        { question: security3, answer: (answer3 || "").trim().toLowerCase() },
      ];
      const allMatch = user.security_questions.every((sq, i) => {
        return (
          submitted[i] &&
          submitted[i].question === sq.question &&
          submitted[i].answer === sq.answer.toLowerCase()
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
      { question: security1, answer: (answer1 || "").trim().toLowerCase() },
      { question: security2, answer: (answer2 || "").trim().toLowerCase() },
      { question: security3, answer: (answer3 || "").trim().toLowerCase() },
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

app.get("/api/vehicles/available", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const vehicles = await db.collection("Vehicles").find({}).toArray();

    let bookedVehicleIds = new Set();

    // Only check overlapping reservations when specific dates are provided
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

    const enriched = vehicles
      .filter((v) => !bookedVehicleIds.has(v._id.toString())) // hide only if dates conflict
      .map((v) => ({
        ...v,
        host_fname: v.host_username ? hostMap[v.host_username] || null : null,
      }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch available vehicles" });
  }
});

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
    const enriched = vehicles.map((v) => ({
      ...v,
      host_fname: v.host_username ? hostMap[v.host_username] || null : null,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

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

app.get("/api/host-financials", requireLogin, async (req, res) => {
  try {
    const username = req.session.user_name;

    // Get all vehicles owned by this host
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

    // Get all reservations that include any of these vehicles
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
      // Exclude cancelled reservations from all financial calculations
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

    // Build response
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

    // Check for overlapping reservations on this vehicle
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

    // Only mark vehicle unavailable immediately if reservation starts today
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

// ── Proxy Pattern: Payment Integration ──────────────────────────────────────
// PaymentGateway  – abstract subject interface
// StripeGateway   – real subject: calls Stripe API (falls back to local store
//                   when STRIPE_SECRET_KEY is not configured)
// PaymentProxy    – proxy: enforces access control, detects duplicates, logs
//                   every operation, then delegates to the real gateway

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? require("stripe")(process.env.STRIPE_SECRET_KEY)
  : null;

// ── Abstract subject ─────────────────────────────────────────────────────────
class PaymentGateway {
  async saveCard(_details) {
    throw new Error("saveCard() not implemented");
  }
  async listCards(_username) {
    throw new Error("listCards() not implemented");
  }
  async deleteCard(_username, _key) {
    throw new Error("deleteCard() not implemented");
  }
}

// ── Real subject ─────────────────────────────────────────────────────────────
// In production, saveCard() expects a Stripe PaymentMethod id created by
// Stripe Elements on the frontend.  When STRIPE_SECRET_KEY is absent (local
// dev), it stores card metadata directly in MongoDB so the app stays runnable
// without Stripe credentials.
class StripeGateway extends PaymentGateway {
  async saveCard(details) {
    const {
      full_name,
      address,
      payment_nickname,
      card_number,
      expiration,
      card_type,
      payment_zip_code,
      user,
      stripePaymentMethodId,
    } = details;

    const [year, month] = expiration.split("-");
    const exp = `${month}/${String(year).slice(-2)}`;
    const cleanCard = card_number.replace(/\D/g, "");
    const last4 = cleanCard.slice(-4);
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    let stripeCustomerId = null;

    if (stripeClient) {
      // Retrieve or create a Stripe Customer tied to this user
      const existing = await db
        .collection("RentalUsers")
        .findOne({ _id: user._id }, { projection: { stripe_customer_id: 1 } });

      if (existing?.stripe_customer_id) {
        stripeCustomerId = existing.stripe_customer_id;
      } else {
        const customer = await stripeClient.customers.create({
          name: full_name,
          metadata: { username: user.username },
        });
        stripeCustomerId = customer.id;
        await db
          .collection("RentalUsers")
          .updateOne(
            { _id: user._id },
            { $set: { stripe_customer_id: stripeCustomerId } },
          );
      }

      // Attach the PaymentMethod sent from the frontend (Stripe Elements token)
      if (stripePaymentMethodId) {
        await stripeClient.paymentMethods.attach(stripePaymentMethodId, {
          customer: stripeCustomerId,
        });
      }
    }

    const entry = {
      customer_name: full_name,
      payment_address: address,
      last4,
      card_type,
      expiration: exp,
      payment_zip_code,
      payment_nickname,
      status: "Active",
      added_at: now,
      ...(stripeCustomerId && { stripe_customer_id: stripeCustomerId }),
    };

    await db.collection("RentalUsers").updateOne(
      { _id: user._id },
      {
        $push: { payment: entry },
        $set: { updated_at: now },
      },
    );

    return entry;
  }

  async listCards(user) {
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

  async deleteCard(user, { last4, expiration }) {
    const result = await db
      .collection("RentalUsers")
      .updateOne(
        { _id: user._id },
        { $pull: { payment: { last4, expiration } } },
      );
    return result.modifiedCount > 0;
  }
}

// ── Proxy ────────────────────────────────────────────────────────────────────
class PaymentProxy extends PaymentGateway {
  constructor(realGateway) {
    super();
    this._gateway = realGateway;
  }

  // Shared: resolve and verify the session user
  async _resolveUser(username) {
    const user = await db.collection("RentalUsers").findOne({ username });
    if (!user)
      throw Object.assign(new Error("User not found"), { status: 404 });
    return user;
  }

  async saveCard(details) {
    const { username } = details;

    // Access control – must be an authenticated RentalUser
    const user = await this._resolveUser(username);
    details.user = user;

    // Input validation
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

    // Duplicate detection – same last-4 + expiration already saved
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

    console.log(`[PaymentProxy] saveCard – user: ${username}, last4: ${last4}`);
    const result = await this._gateway.saveCard(details);
    console.log(`[PaymentProxy] saveCard – success for user: ${username}`);
    return result;
  }

  async listCards(username) {
    const user = await this._resolveUser(username);
    return this._gateway.listCards(user);
  }

  async deleteCard(username, key) {
    const user = await this._resolveUser(username);
    console.log(
      `[PaymentProxy] deleteCard – user: ${username}, last4: ${key.last4}, exp: ${key.expiration}`,
    );
    const removed = await this._gateway.deleteCard(user, key);
    if (!removed) {
      throw Object.assign(new Error("Payment method not found"), {
        status: 404,
      });
    }
    return true;
  }
}

// Instantiate once at startup
const paymentProxy = new PaymentProxy(new StripeGateway());

// ── Routes (thin wrappers – all logic lives in the proxy / gateway) ──────────

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

    // Validate mileage BEFORE updating anything
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

      // Mileage is valid — now complete the reservation
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
    return res.json({ success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: "Server error: " + err.message });
  }
});

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

          // Save in-app notification
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

app.post("/api/vehicle", upload.single("image"), async (req, res) => {
  try {
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
    } = req.body;

    const imagePath = req.file
      ? "assets/img/vehicles/" + req.file.filename
      : "";

    let vehicleData;
    try {
      vehicleData = new VehicleListingBuilder()
        .setBasicInfo(year, make, model, category)
        .setDescription(description)
        .setPricing(rental_rate_per_day)
        .setSpecs(mileage, range)
        .setLocation(pickup_location)
        .setMedia(imagePath)
        .setHost(req.session?.user_name)
        .build();
    } catch (validationErr) {
      return res
        .status(validationErr.status || 400)
        .json({ error: validationErr.message });
    }

    const result = await db.collection("Vehicles").insertOne(vehicleData);
    res.json({
      message: "Vehicle added successfully",
      vehicle: { _id: result.insertedId, ...vehicleData },
    });
  } catch (err) {
    console.error("Add vehicle error:", err);
    res.status(500).json({ error: "Failed to add vehicle" });
  }
});

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

// ADD VEHICLE
app.post("/api/add-vehicle", requireLogin, async (req, res) => {
  try {
    if (req.session.user.user_type !== "host") {
      return res.status(403).json({ error: "Only hosts can add vehicles" });
    }

    const { make, model, year, price, mileage, image_url, category } = req.body;

    let vehicle;
    try {
      vehicle = new VehicleListingBuilder()
        .setBasicInfo(year, make, model, category)
        .setPricing(price)
        .setSpecs(mileage)
        .setMedia(image_url)
        .setHost(req.session.user.username)
        .build();
    } catch (validationErr) {
      return res
        .status(validationErr.status || 400)
        .json({ error: validationErr.message });
    }

    await db.collection("Vehicles").insertOne(vehicle);
    res.json({ success: true, vehicle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add vehicle" });
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
      // For price-drop alerts, only notify if new price is at or below target
      if (changeType === "price") {
        if (!watcher.target_price || newValue > watcher.target_price) continue;
      }

      // Look up the watcher's email
      const user = await db
        .collection("RentalUsers")
        .findOne(
          { username: watcher.username },
          { projection: { email: 1, fname: 1, lname: 1 } },
        );
      if (!user?.email) continue;

      const displayName =
        [user.fname, user.lname].filter(Boolean).join(" ") || watcher.username;

      let subject, html;
      if (changeType === "availability") {
        subject = `DriveShare: ${vehicleName} is now available!`;
        html = `
          <p>Hi ${displayName},</p>
          <p>Good news! A vehicle on your watchlist is now available to rent:</p>
          <p><strong>${vehicleName}</strong> — $${Number(vehicle.rental_rate_per_day).toFixed(2)}/day</p>
          <p><a href="${process.env.APP_URL || "http://localhost:3000"}/vehicle-reservation.html">Book it now &rarr;</a></p>
          <p style="color:#999;font-size:12px;">You received this because you watched this vehicle on DriveShare.</p>`;
      } else {
        subject = `DriveShare: Price drop on ${vehicleName}!`;
        html = `
          <p>Hi ${displayName},</p>
          <p>The price on a vehicle you're watching just dropped:</p>
          <p><strong>${vehicleName}</strong> — now <strong>$${Number(newValue).toFixed(2)}/day</strong>
            (your target: $${Number(watcher.target_price).toFixed(2)}/day)</p>
          <p><a href="${process.env.APP_URL || "http://localhost:3000"}/vehicle-reservation.html">Book it now &rarr;</a></p>
          <p style="color:#999;font-size:12px;">You received this because you watched this vehicle on DriveShare.</p>`;
      }

      await mailer.sendMail({
        from: `"DriveShare" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject,
        html,
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

    // Enforce one watch per user — remove any existing watch before adding the new one
    await db.collection("WatchList").deleteMany({ username });

    await db.collection("WatchList").insertOne({
      username,
      vehicle_id: new ObjectId(vehicle_id),
      target_price: target_price ? Number(target_price) : null,
      start_date: start_date || null,
      end_date: end_date || null,
      created_at: new Date(),
    });

    // Save in-app notification + send watch confirmation email (Observer pattern)
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
                label: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
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

// GET REVIEWS
app.get("/api/reviews/:vehicleId", async (req, res) => {
  const reviews = await db
    .collection("Reviews")
    .find({
      vehicle_id: new ObjectId(req.params.vehicleId),
    })
    .toArray();

  res.json(reviews);
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

      // Capture old price before updating so we can detect a drop
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
          (await db
            .collection("RentalUsers")
            .findOne({ username: to_username })) ||
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
        if (
          recipient.email &&
          process.env.GMAIL_USER &&
          process.env.GMAIL_PASS
        ) {
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
            console.error(
              "Message email notification failed:",
              emailErr.message,
            );
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
                vehicleLabel = [v.year, v.make, v.model]
                  .filter(Boolean)
                  .join(" ");
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
                vehicleLabel = [v.year, v.make, v.model]
                  .filter(Boolean)
                  .join(" ");
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
        if (!vehicle)
          return res.status(404).json({ error: "Vehicle not found." });
        res.json({ host_username: vehicle.host_username });
      } catch (err) {
        res.status(500).json({ error: "Failed to get host info." });
      }
    });

    // ── Host reviews (for ownerPage.html) ───────────────────────
    app.get("/api/host-reviews", requireLogin, async (req, res) => {
      try {
        const username = req.session.user_name;
        const reviews = await db
          .collection("Reviews")
          .find({ reviewed_username: username, review_type: "car" })
          .sort({ createdAt: -1 })
          .toArray();

        const enriched = await Promise.all(
          reviews.map(async (r) => {
            let vehicleLabel = "Unknown";
            if (r.car_id) {
              const v = await db
                .collection("Vehicles")
                .findOne({ _id: new ObjectId(r.car_id) });
              if (v)
                vehicleLabel = [v.year, v.make, v.model]
                  .filter(Boolean)
                  .join(" ");
            }
            return {
              customer: r.reviewer_username,
              vehicle: vehicleLabel,
              rentalDate: r.createdAt
                ? new Date(r.createdAt).toLocaleDateString()
                : "—",
              rating: "★".repeat(r.rating) + "☆".repeat(5 - r.rating),
              review: r.comment || "—",
              submitted: r.createdAt
                ? new Date(r.createdAt).toLocaleDateString()
                : "—",
              actions: "—",
            };
          }),
        );

        res.json(enriched);
      } catch (err) {
        res.status(500).json([]);
      }
    });

    // ── Host pending reviews (completed rentals not yet reviewed) ──
    app.get("/api/host-pending-reviews", requireLogin, async (req, res) => {
      try {
        const username = req.session.user_name;

        // Get all completed reservations for this host's vehicles
        const vehicles = await db
          .collection("Vehicles")
          .find({ host_username: username })
          .toArray();
        const vehicleIds = vehicles.map((v) => v._id);

        const completed = await db
          .collection("Reservations")
          .find({
            history_vehicle_id: { $in: vehicleIds },
            status: "Complete",
          })
          .toArray();

        // Find which ones the host hasn't reviewed yet
        const existingReviews = await db
          .collection("Reviews")
          .find({ reviewer_username: username, review_type: "renter" })
          .toArray();
        const reviewedBookingIds = new Set(
          existingReviews.map((r) => r.booking_id?.toString()),
        );

        const pending = completed.filter(
          (r) => !reviewedBookingIds.has(r._id.toString()),
        );

        const vehicleMap = {};
        vehicles.forEach((v) => {
          vehicleMap[v._id.toString()] = [v.year, v.make, v.model]
            .filter(Boolean)
            .join(" ");
        });

        const result = pending.map((r) => {
          const vid = (r.history_vehicle_id || r.vehicle_id)?.toString();
          return {
            customer: r.customer_name || "—",
            vehicle: vehicleMap[vid] || "Unknown",
            rentalPeriod: `${r.start_date || "—"} → ${r.end_date || "—"}`,
            customerReview: "Not yet reviewed",
            action: `<button class="btn btn-sm btn-primary" onclick="openReviewModal('${r._id}','${r.customer_name}')">Write Review</button>`,
            bookingId: r._id,
          };
        });

        res.json(result);
      } catch (err) {
        res.status(500).json([]);
      }
    });

    // ── Submit a review ─────────────────────────────────────────
    app.post("/api/reviews", requireLogin, async (req, res) => {
      try {
        const { booking_id, reviewed_username, review_type, rating, title, comment } =
          req.body;
        const reviewer_username = req.session.user_name;

        if (!rating || rating < 1 || rating > 5) {
          return res
            .status(400)
            .json({ error: "Rating must be between 1 and 5." });
        }

        // Get booking to find car_id
        let car_id = null;
        if (booking_id && ObjectId.isValid(booking_id)) {
          const booking = await db
            .collection("Reservations")
            .findOne({ _id: new ObjectId(booking_id) });
          if (booking) {
            car_id = booking.history_vehicle_id || booking.vehicle_id;
          }
        }

        const review = {
          booking_id: ObjectId.isValid(booking_id)
            ? new ObjectId(booking_id)
            : null,
          car_id,
          reviewer_username,
          reviewed_username,
          review_type: review_type || "car",
          rating: parseInt(rating),
          title: title || "",
          comment: comment || "",
          createdAt: new Date(),
        };

        await db.collection("Reviews").insertOne(review);

        // Update vehicle avg rating
        if (car_id) {
          const allReviews = await db
            .collection("Reviews")
            .find({ car_id, review_type: "car" })
            .toArray();
          const avg =
            allReviews.reduce((sum, r) => sum + r.rating, 0) /
            allReviews.length;
          await db.collection("Vehicles").updateOne(
            { _id: new ObjectId(car_id.toString()) },
            {
              $set: {
                avg_rating: Math.round(avg * 10) / 10,
                review_count: allReviews.length,
              },
            },
          );
        }

        res.json({ success: true });
      } catch (err) {
        console.error("Review error:", err);
        res.status(500).json({ error: "Failed to submit review." });
      }
    });

    // ── Customer: get completed rentals for review dropdown ──────
    app.get("/api/customer-completed-rentals", requireLogin, async (req, res) => {
      try {
        const username = req.session.user_name;
        const user = await db.collection("RentalUsers").findOne({ username });
        if (!user) return res.status(404).json({ error: "User not found" });

        const completed = await db
          .collection("Reservations")
          .find({ user_id: user._id, status: "Complete" })
          .sort({ end_date: -1 })
          .toArray();

        if (completed.length === 0) return res.json([]);

        const vehicleIds = completed
          .map((r) => {
            const rawId = r.history_vehicle_id || r.vehicle_id;
            try {
              return rawId && ObjectId.isValid(rawId) ? new ObjectId(rawId) : null;
            } catch { return null; }
          })
          .filter(Boolean);

        const vehicles = await db
          .collection("Vehicles")
          .find({ _id: { $in: vehicleIds } })
          .toArray();
        const vehicleMap = {};
        vehicles.forEach((v) => { vehicleMap[v._id.toString()] = v; });

        // Filter out rentals already reviewed by this customer
        const existingReviews = await db
          .collection("Reviews")
          .find({ reviewer_username: username, review_type: "car" })
          .toArray();
        const reviewedBookingIds = new Set(
          existingReviews.map((r) => r.booking_id?.toString())
        );

        const result = completed
          .filter((r) => !reviewedBookingIds.has(r._id.toString()))
          .map((r) => {
            const vid = (r.history_vehicle_id || r.vehicle_id)?.toString();
            const v = vehicleMap[vid] || {};
            const name = [v.year, v.make, v.model].filter(Boolean).join(" ") || v.name || "Unknown Vehicle";
            return {
              bookingId: r._id,
              vehicleName: name,
              hostUsername: v.host_username || null,
              endDate: r.end_date || null,
            };
          });

        res.json(result);
      } catch (err) {
        console.error("customer-completed-rentals error:", err);
        res.status(500).json({ error: "Failed to fetch completed rentals." });
      }
    });

    // ── Customer: get reviews submitted by this customer ──────────
    app.get("/api/my-reviews", requireLogin, async (req, res) => {
      try {
        const username = req.session.user_name;
        const reviews = await db
          .collection("Reviews")
          .find({ reviewer_username: username, review_type: "car" })
          .sort({ createdAt: -1 })
          .toArray();

        const carIds = reviews
          .map((r) => {
            try { return r.car_id && ObjectId.isValid(r.car_id) ? new ObjectId(r.car_id) : null; }
            catch { return null; }
          })
          .filter(Boolean);

        const vehicleMap = {};
        if (carIds.length > 0) {
          const vDocs = await db.collection("Vehicles").find({ _id: { $in: carIds } }).toArray();
          vDocs.forEach((v) => { vehicleMap[v._id.toString()] = v; });
        }

        const result = reviews.map((r) => {
          const v = vehicleMap[r.car_id?.toString()] || {};
          const vehicleName = [v.year, v.make, v.model].filter(Boolean).join(" ") || v.name || "Unknown Vehicle";
          return {
            vehicleName,
            rating: r.rating,
            title: r.title || "",
            comment: r.comment || "",
            date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—",
          };
        });

        res.json(result);
      } catch (err) {
        console.error("my-reviews error:", err);
        res.status(500).json({ error: "Failed to fetch reviews." });
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

        console.log(
          `[Observer] ${username} is now watching vehicle ${vehicleId}`,
        );
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
        const list = await db
          .collection("WatchList")
          .find({ username })
          .toArray();

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
    app.get(
      "/api/notifications/unread-count",
      requireLogin,
      async (req, res) => {
        try {
          const username = req.session.user_name;
          const count = await db
            .collection("Notifications")
            .countDocuments({ username, read: false });

          res.json({ count });
        } catch (err) {
          res.status(500).json({ count: 0 });
        }
      },
    );
  },
);
