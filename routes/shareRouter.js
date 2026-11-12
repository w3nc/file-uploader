const express = require("express");
const { prisma, usedBytes } = require("../lib/db");
const { requireLogin, checkCsrf } = require("../middleware/auth");
const { isUuid, daysLeft, isImageName } = require("../lib/format");
const { fetchFromCloud } = require("../lib/cloud");

const router = express.Router();

// Share links: a signed-in user's list of folder links that are still alive
router.get("/shared", requireLogin, async (req, res, next) => {
  try {
    const shares = await prisma.share.findMany({
      where: { userId: req.user.id, expiresAt: { gt: new Date() } },
      include: { folder: true },
      orderBy: { createdAt: "desc" },
    });
    const links = shares.map((s) => ({
      id: s.id,
      expires_at: s.expiresAt,
      folder_id: s.folderId,
      name: s.folder.name,
      days: daysLeft(s.expiresAt),
    }));
    res.render("shared", {
      title: "Shared links",
      links,
      newId: isUuid(req.query.new) ? req.query.new : null,
      usedBytes: await usedBytes(req.user.id),
      baseUrl: process.env.BASE_URL || `${req.protocol}://${req.get("host")}`,
    });
  } catch (err) {
    next(err);
  }
});

// Makes a share link for one folder. The user picks 1, 10 or 30 days.
router.post("/folders/:id/share", requireLogin, checkCsrf, async (req, res, next) => {
  try {
    const days = [1, 10, 30].includes(Number(req.body.days)) ? Number(req.body.days) : 10;
    if (!isUuid(req.params.id)) return res.redirect("/");
    const folder = await prisma.folder.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!folder) return res.redirect("/");

    const expiresAt = new Date(Date.now() + days * 86400000);
    const share = await prisma.share.create({
      data: { userId: req.user.id, folderId: folder.id, expiresAt },
    });
    res.redirect(`/shared?new=${share.id}`);
  } catch (err) {
    next(err);
  }
});

// Public share page: anyone with the link can see the folder and download
router.get("/share/:id", async (req, res, next) => {
  try {
    const share = await activeShare(req.params.id);
    if (!share) {
      return res.status(404).render("error", { title: "Link expired", message: "This share link has expired or does not exist." });
    }
    const files = await prisma.file.findMany({ where: { folderId: share.folder_id }, orderBy: { originalName: "asc" } });
    res.render("share", {
      title: share.folder_name,
      folderName: share.folder_name,
      days: daysLeft(share.expires_at),
      files: files.map((f) => ({
        id: f.id,
        original_name: f.originalName,
        size_bytes: f.sizeBytes,
        mime_type: f.mimeType,
      })),
      shareId: share.id,
    });
  } catch (err) {
    next(err);
  }
});

// Shows one image from a shared folder inside the card (not a download)
router.get("/share/:id/files/:fileId/view", async (req, res, next) => {
  try {
    const share = await activeShare(req.params.id);
    if (!share || !isUuid(req.params.fileId)) return res.status(404).end();
    const file = await prisma.file.findFirst({ where: { id: req.params.fileId, folderId: share.folder_id } });
    if (!file || !isImageName(file.originalName)) return res.status(404).end();
    const data = await fetchFromCloud(file.cloudUrl);
    res.type(file.mimeType).send(data);
  } catch (err) {
    next(err);
  }
});

router.get("/share/:id/files/:fileId/download", async (req, res, next) => {
  try {
    const share = await activeShare(req.params.id);
    if (!share || !isUuid(req.params.fileId)) {
      return res.status(404).render("error", { title: "Link expired", message: "This share link has expired or does not exist." });
    }
    const file = await prisma.file.findFirst({ where: { id: req.params.fileId, folderId: share.folder_id } });
    if (!file) return res.status(404).render("error", { title: "Not found", message: "That file was not found." });
    const data = await fetchFromCloud(file.cloudUrl);
    res.attachment(file.originalName);
    res.type(file.mimeType).send(data);
  } catch (err) {
    next(err);
  }
});

// Returns the share only when it exists and has not expired
async function activeShare(id) {
  if (!isUuid(id)) return null;
  const share = await prisma.share.findFirst({
    where: { id, expiresAt: { gt: new Date() } },
    include: { folder: true },
  });
  if (!share) return null;
  return {
    id: share.id,
    folder_id: share.folderId,
    expires_at: share.expiresAt,
    folder_name: share.folder.name,
  };
}

module.exports = router;
