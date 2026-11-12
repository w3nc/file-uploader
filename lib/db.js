const { PrismaClient } = require("@prisma/client");

// One shared connection to the database, used by every route
const prisma = new PrismaClient({
  ...(process.env.DATABASE_SSL === "true" && {
    datasources: {
      db: {
        url: process.env.DATABASE_URL.includes("?")
          ? process.env.DATABASE_URL + "&sslmode=require"
          : process.env.DATABASE_URL + "?sslmode=require",
      },
    },
  }),
});

module.exports = { prisma };
