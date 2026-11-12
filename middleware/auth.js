// Login checks: only signed-in users reach the drive, and every form must
// carry the secret token from the session (stops other sites from acting for the user)
function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect("/login");
}

function checkCsrf(req, res, next) {
  const sent = req.body && req.body._csrf;
  if (!sent || sent !== req.session.csrfToken) {
    return res.status(403).render("error", { title: "Expired", message: "That form expired. Please try again." });
  }
  next();
}

module.exports = { requireLogin, checkCsrf };
