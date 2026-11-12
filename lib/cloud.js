const crypto = require("node:crypto");
const path = require("node:path");
const { v2: cloudinary } = require("cloudinary");

// Your Cloudinary login details come from the .env file. Never write them here.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Every file is stored as a "raw" file, so Cloudinary keeps it exactly as it is.
function uploadToCloud(file) {
  const publicId = crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "raw", public_id: publicId },
      (err, result) => {
        if (err) return reject(err);
        resolve({ publicId: result.public_id, url: result.secure_url });
      }
    );
    stream.end(file.buffer);
  });
}

// Deletes a file from Cloudinary. A missing file is not an error.
function removeFromCloud(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true }).catch(() => {});
}

async function fetchFromCloud(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cloudinary download failed with status ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { uploadToCloud, removeFromCloud, fetchFromCloud };
