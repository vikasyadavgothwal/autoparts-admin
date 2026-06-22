
import "dotenv/config"
import { defineConfig } from "prisma/config"

const prismaConfig = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})

export default prismaConfig
