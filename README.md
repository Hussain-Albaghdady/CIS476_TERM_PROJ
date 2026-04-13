 ---------------------------------------------------
Access Live Version
---------------------------------------------------
Link: https://driveshare-6b05ff2378e7.herokuapp.com/

===================================================
  DriveShare — How to Run the Application Locally
===================================================

REQUIREMENTS
------------
- Node.js v24.x  (https://nodejs.org)
- npm v11.x      (comes with Node.js)
- A MongoDB Atlas account with a cluster set up
- A Gmail account (for sending emails via Nodemailer)

---------------------------------------------------
STEP 1 — Clone / Open the Project
---------------------------------------------------
Make sure you are inside the project folder:

  cd CIS476_TERM_PROJ

---------------------------------------------------
STEP 2 — Install Dependencies
---------------------------------------------------
Run this once (or whenever package.json changes):

  npm install

---------------------------------------------------
STEP 3 — Configure Environment Variables (manual)
---------------------------------------------------
If the files do not exist!

Create a file named .env in the project root
(it may already exist). It needs the following:

  GMAIL_USER=<your Gmail address>
  GMAIL_PASS=<your Gmail app password>
  SESSION_SECRET=<any long random string>
  CORS_ORIGIN=http://localhost:3000

  NODE_ENV=development   (use "production" when deploying)
  PORT=3000              (optional, defaults to 3000)

  NOTE: MONGODB_URI can also be set in atlas_uri.js
  instead of .env if you prefer.

  Gmail App Password setup:
    1. Enable 2-Step Verification on your Google account
    2. Go to Google Account > Security > App Passwords
    3. Generate a password for "Mail" and paste it above
    
Create a file named atlas_uri.js in the project root
(it may already exist). It needs the following:

  MONGODB_URI=<your MongoDB Atlas connection string>
  
---------------------------------------------------
STEP 3 — Configure Environment Variables (existing)
---------------------------------------------------  
Copy over the files atlas_uri.js and .env into the
project root.

---------------------------------------------------
STEP 4 — Start the Server
---------------------------------------------------

  npm start

  Or directly:

  node server.js

---------------------------------------------------
STEP 5 — Open the App
---------------------------------------------------
Open your browser and go to:

  http://localhost:3000

---------------------------------------------------
STOPPING THE SERVER
---------------------------------------------------
Press  Ctrl + C  in the terminal.

---------------------------------------------------
NOTES
---------------------------------------------------
- The app uses MongoDB Atlas (cloud). Make sure your
  IP address is whitelisted in Atlas Network Access.
- Session cookies are set to secure=false in
  development mode, so HTTP (localhost) works fine.
- In production, set NODE_ENV=production and serve
  over HTTPS.
===================================================
