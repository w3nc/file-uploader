const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/db");

passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (!user) return done(null, false);

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) return done(null, false);

      return done(null, { id: user.id, email: user.email, name: user.name });
    } catch (err) {
      return done(err);
    }
  })
);

// The session only remembers the user's id
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});
