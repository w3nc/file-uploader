const express = require("express");
const { prisma, toFile, usedBytes } = require("../lib/db");
const { requireLogin, checkCsrf } = require("../middleware/auth");
const { isUuid, isImageName } = require("../lib/format");
const { uploadSingle } = require("../lib/upload");
const { uploadToCloud, removeFromCloud, fetchFromCloud } = require("../lib/cloud");

const router = express.Router();
router.use(requireLogin);

async function ownFolder(userId, id) {
  if (!isUuid(id)) return null;
  return prisma.folder.findFirst({ where: { id, userId } });
}

async function ownFile(userId, id) {
  if (!isUuid(id)) return null;
  const file = await prisma.file.findFirst({ where: { id, userId }, include: { folder: true } });
  return file ? toFile(file) : null;
}

// My Drive: the folders and the loose files at the top level
router.get("/", async (req, res, next) => {
  try {
    const folders = await prisma.folder.findMany({ where: { userId: req.user.id }, orderBy: { name: "asc" } });
    const files = await prisma.file.findMany({
      where: { userId: req.user.id, folderId: null },
      orderBy: { originalName: "asc" },
    });
    res.render("drive", {
      title: "My Drive",
      folder: null,
      folders,
      files: files.map(toFile),
      usedBytes: await usedBytes(req.user.id),
      error: req.query.error ? String(req.query.error) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/folders/:id", async (req, res, next) => {
  try {
    const folder = await ownFolder(req.user.id, req.params.id);
    if (!folder) return res.status(404).render("error", { title: "Not found", message: "That folder was not found." });
    const files = await prisma.file.findMany({
      where: { userId: req.user.id, folderId: folder.id },
      orderBy: { originalName: "asc" },
    });
    res.render("drive", {
      title: folder.name,
      folder,
      folders: [],
      files: files.map(toFile),
      usedBytes: await usedBytes(req.user.id),
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/folders", checkCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 60) {
      return res.redirect(`/?error=${encodeURIComponent("Folder name must be 1 to 60 characters.")}`);
    }
    await prisma.folder.create({ data: { userId: req.user.id, name } });
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

router.post("/folders/:id/rename", checkCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 60) {
      return res.redirect(`/?error=${encodeURIComponent("Folder name must be 1 to 60 characters.")}`);
    }
    const folder = await ownFolder(req.user.id, req.params.id);
    if (folder) {
      await prisma.folder.update({ where: { id: folder.id }, data: { name } });
    }
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

// Deleting a folder also deletes the files inside it from Cloudinary
router.post("/folders/:id/delete", checkCsrf, async (req, res, next) => {
  try {
    const folder = await ownFolder(req.user.id, req.params.id);
    if (folder) {
      const files = await prisma.file.findMany({ where: { folderId: folder.id, userId: req.user.id } });
      await prisma.folder.delete({ where: { id: folder.id } });
      await Promise.all(files.map((f) => removeFromCloud(f.storedName)));
    }
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

router.get("/upload", async (req, res, next) => {
  try {
    const folders = await prisma.folder.findMany({ where: { userId: req.user.id }, orderBy: { name: "asc" } });
    res.render("upload", { title: "Upload file", folders, selected: req.query.folder || "", error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/upload", uploadSingle, checkCsrf, async (req, res, next) => {
  try {
    const folders = await prisma.folder.findMany({ where: { userId: req.user.id }, orderBy: { name: "asc" } });
    const selected = req.body.folder || "";
    const error = req.uploadError || (!req.file ? "Please choose a file first." : null);
    if (error) {
      return res.status(400).render("upload", { folders, selected, error });
    }

    // An empty folder choice means My Drive (no folder)
    let folderId = null;
    if (selected) {
      const folder = await ownFolder(req.user.id, selected);
      if (!folder) {
        return res.status(400).render("upload", { folders, selected: "", error: "Please choose a folder." });
      }
      folderId = folder.id;
    }

    // Send the file to Cloudinary, then save its web address in the database
    const cloud = await uploadToCloud(req.file);
    const file = await prisma.file.create({
      data: {
        userId: req.user.id,
        folderId,
        originalName: req.file.originalname,
        storedName: cloud.publicId,
        cloudUrl: cloud.url,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      },
    });
    res.redirect(`/files/${file.id}`);
  } catch (err) {
    next(err);
  }
});

router.get("/files/:id", async (req, res, next) => {
  try {
    const file = await ownFile(req.user.id, req.params.id);
    if (!file) return res.status(404).render("error", { title: "Not found", message: "That file was not found." });
    res.render("file", { title: file.original_name, file });
  } catch (err) {
    next(err);
  }
});

// Shows an image inside the details page (not a download)
router.get("/files/:id/view", async (req, res, next) => {
  try {
    const file = await ownFile(req.user.id, req.params.id);
    if (!file || !isImageName(file.original_name)) return res.status(404).end();
    const data = await fetchFromCloud(file.cloud_url);
    res.type(file.mime_type).send(data);
  } catch (err) {
    next(err);
  }
});

router.get("/files/:id/download", async (req, res, next) => {
  try {
    const file = await ownFile(req.user.id, req.params.id);
    if (!file) return res.status(404).render("error", { title: "Not found", message: "That file was not found." });
    const data = await fetchFromCloud(file.cloud_url);
    res.attachment(file.original_name);
    res.type(file.mime_type).send(data);
  } catch (err) {
    next(err);
  }
});

router.post("/files/:id/delete", checkCsrf, async (req, res, next) => {
  try {
    const file = await ownFile(req.user.id, req.params.id);
    if (file) {
      await prisma.file.delete({ where: { id: file.id } });
      await removeFromCloud(file.stored_name);
      return res.redirect(file.folder_id ? `/folders/${file.folder_id}` : "/");
    }
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
