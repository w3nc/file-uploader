const { PrismaClient } = require("@prisma/client");

// One shared connection to the database, used by every route
const prisma = new PrismaClient();

// Turns a file row from Prisma into the names the pages already use
function toFile(f) {
  return {
    id: f.id,
    user_id: f.userId,
    folder_id: f.folderId,
    original_name: f.originalName,
    stored_name: f.storedName,
    cloud_url: f.cloudUrl,
    mime_type: f.mimeType,
    size_bytes: f.sizeBytes,
    uploaded_at: f.uploadedAt,
    folder_name: f.folder ? f.folder.name : null,
  };
}

// Total size of all files a user has uploaded, in bytes
async function usedBytes(userId) {
  const result = await prisma.file.aggregate({ where: { userId }, _sum: { sizeBytes: true } });
  return result._sum.sizeBytes || 0;
}

module.exports = { prisma, toFile, usedBytes };
