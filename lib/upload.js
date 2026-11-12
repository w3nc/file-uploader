const path = require("node:path");
const multer = require("multer");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Only these file endings, each with the file type it must have
const ALLOWED = {
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
};

// Browsers send names as UTF-8, but multer reads them as latin1. This fixes that.
function decodeName(name) {
  return Buffer.from(String(name), "latin1").toString("utf8");
}

// The file is kept in memory for a moment, then sent to Cloudinary. Nothing is saved on this PC.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const types = ALLOWED[ext];
  if (!types || !types.includes(file.mimetype)) {
    const err = new Error("File type not allowed");
    err.code = "BAD_FILE_TYPE";
    err.fileName = file.originalname;
    return cb(err);
  }
  cb(null, true);
}

const multerSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES, files: 1 },
}).single("file");

// Runs the upload. A bad file does not crash the page: the message is saved on
// the request so the upload page can show it under the box.
function uploadSingle(req, res, next) {
  multerSingle(req, res, (err) => {
    if (!err) {
      if (req.file) req.file.originalname = decodeName(req.file.originalname);
      return next();
    }
    if (err.code === "BAD_FILE_TYPE") {
      req.uploadError = `${decodeName(err.fileName)} isn't an allowed file type.`;
    } else if (err.code === "LIMIT_FILE_SIZE") {
      req.uploadError = "That file is bigger than 5 MB.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      req.uploadError = "Please choose one file at a time.";
    } else {
      return next(err);
    }
    next();
  });
}

module.exports = { uploadSingle };
