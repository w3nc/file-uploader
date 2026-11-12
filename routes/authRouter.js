const express = require("express");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/db");
const { checkCsrf } = require("../middleware/auth");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.user) return res.redirect("/");
  res.render("login", { title: "Sign in", error: null, email: "" });
});

router.post(
  "/login",
  checkCsrf,
  (req, res, next) => {
    if (!String(req.body.email || "").trim() || !req.body.password) {
      return res.status(400).render("login", {
        title: "Sign in",
        error: "Enter your email and password.",
        email: req.body.email || "",
      });
    }
    passport.authenticate("local", (err, user) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).render("login", {
          title: "Sign in",
          error: "Wrong email or password.",
          email: req.body.email || "",
        });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.redirect("/");
      });
    })(req, res, next);
  }
);

router.get("/signup", (req, res) => {
  if (req.user) return res.redirect("/");
  res.render("signup", { title: "Create account", error: null, email: "", name: "" });
});

router.post("/signup", checkCsrf, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");
    const fail = (error) =>
      res.status(400).render("signup", { title: "Create account", error, email, name });

    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return fail("Please enter a valid email.");
    if (!name || name.length > 100) return fail("Please enter your name.");
    if (password.length < 8) return fail("Password needs at least 8 characters.");
    if (password.length > 72) return fail("Password can be 72 characters at most.");

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return fail("That email already has an account.");

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, passwordHash: hash },
      select: { id: true, email: true, name: true },
    });
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.redirect("/");
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", checkCsrf, (req, res, next) => {
  req.logOut((err) => {
    if (err) return next(err);
    res.redirect("/login");
  });
});

module.exports = router;
