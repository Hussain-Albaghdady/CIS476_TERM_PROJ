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

async function sendReservationEmail(to, reservation, vehicle, last4, baseUrl) {
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
app.post("/reset_password", async (req, res) => {
  const {
    username,
    security1,
    answer1,
    security2,
    answer2,
    security3,
    answer3,
    new_password,
    confirm_password,
  } = req.body;

  try {
    if (!username || !new_password || !confirm_password) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("All fields are required.")}`,
      );
    }

    if (new_password !== confirm_password) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("Passwords do not match.")}`,
      );
    }

    // Find user across both collections
    const collections = ["RentalUsers", "HostUsers"];
    let user = null;
    let collection = null;
    for (const coll of collections) {
      const found = await db.collection(coll).findOne({ username });
      if (found) {
        user = found;
        collection = coll;
        break;
      }
    }

    if (!user) {
      return res.redirect(
        `passwordResetForm.html?error=${encodeURIComponent("No account found with that username.")}`,
      );
    }

    // Verify security questions if stored on the user
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

    const hash = crypto.createHash("sha256").update(new_password).digest("hex");
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db
      .collection(collection)
      .updateOne({ username }, { $set: { password: hash, updated_at: now } });

    console.log(`Password reset successful for user: ${username}`);
    return res.redirect(
      `loginform.html?success=${encodeURIComponent("Password reset successfully. Please sign in.")}`,
    );
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
      sendReservationEmail(renterUser.email, data, vehicle, last4, baseUrl);
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

app.post("/payments", requireLogin, async (req, res) => {
  try {
    const {
      full_name,
      address,
      payment_nickname,
      card_number,
      expiration,
      card_type,
      payment_zip_code,
    } = req.body;
    if (
      !full_name ||
      !address ||
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

    if (!/^\d{4}-\d{2}$/.test(expiration)) {
      return res.status(400).json({ error: "Invalid expiration date" });
    }

    const [year, month] = expiration.split("-");
    const exp = `${month}/${String(year).slice(-2)}`;
    const cleanCardNumber = card_number.replace(/\D/g, "");
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      return res.status(400).json({ error: "Invalid card number" });
    }
    const entry = {
      customer_name: full_name,
      payment_address: address,
      last4: String(cleanCardNumber).slice(-4),
      card_type: card_type,
      expiration: exp,
      payment_zip_code: payment_zip_code,
      payment_nickname: payment_nickname,
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
      return {
        order_id: r.orderId || "N/A",
        order_date: r.order_date,
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status || "Booked",
        location: r.location || "",
        total_cost: r.total_cost || 0,
        items: vehicleEntries.map((v) => v.name),
        mileage: vehicleEntries
          .map((v) => v.mileage)
          .filter((m) => m !== undefined),
      };
    });

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
      payment_address: p.payment_address || "N/A",
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

    if (
      !year ||
      !make ||
      !model ||
      !category ||
      !rental_rate_per_day ||
      !mileage ||
      !range ||
      !pickup_location
    ) {
      return res.status(400).json({
        error:
          "Year, make, model, category, rental rate, mileage, range, and pickup location are required",
      });
    }

    let imagePath = "";
    if (req.file) {
      imagePath = "assets/img/vehicles/" + req.file.filename;
    }

    const vehicleData = {
      year: year ? parseInt(year) : null,
      make: make ? make.trim() : "",
      model: model.trim(),
      category: category.trim(),
      description: description ? description.trim() : "",
      mileage: parseInt(mileage),
      range: parseInt(range),
      pickup_location: pickup_location.trim(),
      rental_rate_per_day: parseFloat(rental_rate_per_day),
      quantity_available: 1,
      availability: true,
      host_username: req.session?.user_name || null,
      image_url: imagePath,
      created_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update availability" });
  }
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

      const updateData = {
        year: year ? parseInt(year) : null,
        make: make ? make.trim() : "",
        model: model.trim(),
        category: category.trim(),
        description: description ? description.trim() : "",
        ...(mileage !== undefined && { mileage: parseInt(mileage) }),
        ...(range !== undefined && { range: parseInt(range) }),
        ...(pickup_location && { pickup_location: pickup_location.trim() }),
        rental_rate_per_day: parseFloat(rental_rate_per_day),
        updated_at: new Date().toISOString().replace("T", " ").substring(0, 19),
      };

      if (req.file) {
        updateData.image_url = "assets/img/vehicles/" + req.file.filename;
      }

      const result = await db
        .collection("Vehicles")
        .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

      if (result.modifiedCount > 0) {
        res.json({ success: true, message: "Vehicle updated successfully" });
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
