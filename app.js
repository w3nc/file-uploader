require("dotenv").config();
const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const passport = require("passport");
const { prisma } = require("./lib/db");
const { formatSize, formatDate, formatType, expiresText, isImageName } = require("./lib/format");
require("./config/passport");

const authRouter = require("./routes/authRouter");
const shareRouter = require("./routes/shareRouter");
const driveRouter = require("./routes/driveRouter");

const app = express();

// Render and similar hosts put the app behind their own proxy, so trust it
app.set("trust proxy", 1);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.locals.formatSize = formatSize;
app.locals.formatDate = formatDate;
app.locals.formatType = formatType;
app.locals.expiresText = expiresText;
app.locals.isImageName = isImageName;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));

// Sessions are stored in the database through Prisma, so a log-in survives a server restart
app.use(
  session({
    store: new PrismaSessionStore(prisma, { checkPeriod: 2 * 60 * 1000, dbRecordIdIsSessionId: true }),
    secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // A live site uses https, so only then require a secure cookie
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // one week
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Every page gets the logged-in user and a secret token for its forms
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// Share router first: its public links must not hit the sign-in check below
app.use("/", authRouter);
app.use("/", shareRouter);
app.use("/", driveRouter);

app.use((req, res) => {
  res.status(404).render("error", { title: "Not found", message: "Page not found." });
});

app.use((err, req, res, next) => {
  // The real error goes to the server log so it can be read on the host
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render("error", { title: "Error", message: "Something went wrong. Please try again." });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Odin Drive is running on port ${PORT}`);
});
