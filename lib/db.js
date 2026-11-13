const { PrismaClient } = require("@prisma/client");

// One shared connection to the database, used by every route
// Render's managed PostgreSQL requires SSL. Default to sslmode=require
// unless DATABASE_SSL is explicitly set to "false" (local dev only).
const forceSsl = process.env.DATABASE_SSL !== "false";

const prisma = new PrismaClient({
  ...(forceSsl && {
    datasources: {
      db: {
        url: process.env.DATABASE_URL.includes("?")
          ? process.env.DATABASE_URL + "&sslmode=require"
          : process.env.DATABASE_URL + "?sslmode=require",
      },
    },
  }),
});

// Turns a database file row into the snake_case names the pages use
function toFile(file) {
  return {
    id: file.id,
    original_name: file.originalName,
    stored_name: file.storedName,
    cloud_url: file.cloudUrl,
    mime_type: file.mimeType,
    size_bytes: file.sizeBytes,
    uploaded_at: file.uploadedAt,
    folder_id: file.folderId,
    folder_name: file.folder ? file.folder.name : null,
  };
}

// Total bytes this user has stored, shown in the sidebar meter
async function usedBytes(userId) {
  const total = await prisma.file.aggregate({
    where: { userId },
    _sum: { sizeBytes: true },
  });
  return total._sum.sizeBytes || 0;
}

module.exports = { prisma, toFile, usedBytes };
