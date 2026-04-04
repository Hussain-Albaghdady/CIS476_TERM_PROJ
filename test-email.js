require("dotenv").config();
const nodemailer = require("nodemailer");

const { GMAIL_USER, GMAIL_PASS } = process.env;

if (!GMAIL_USER || !GMAIL_PASS) {
  console.error("Missing GMAIL_USER or GMAIL_PASS in .env");
  process.exit(1);
}

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

mailer.sendMail({
  from: `"DriveShare" <${GMAIL_USER}>`,
  to: GMAIL_USER,
  subject: "DriveShare — Email Test",
  html: "<h2>It works!</h2><p>Your DriveShare email setup is working correctly.</p>",
}, (err, info) => {
  if (err) {
    console.error("Failed:", err.message);
  } else {
    console.log("Email sent successfully:", info.messageId);
  }
});
