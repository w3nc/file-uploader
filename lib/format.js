const path = require("node:path");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True only for a real id, so a made-up address never reaches the database
function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

// 214 KB, 1.2 MB, 2.26 GB
function formatSize(bytes) {
  const n = Number(bytes);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

// 12 Nov 2026, 9:41 am
function formatDate(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// resume.pdf -> PDF
function formatType(name) {
  return path.extname(name).slice(1).toUpperCase();
}

function isImageName(name) {
  return /\.(png|jpe?g)$/i.test(name);
}

// Whole days left until a link expires (0 or less means expired)
function daysLeft(expiresAt) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function expiresText(days) {
  if (days <= 0) return "Expired";
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

module.exports = {
  isUuid,
  formatSize,
  formatDate,
  formatType,
  isImageName,
  daysLeft,
  expiresText,
};
