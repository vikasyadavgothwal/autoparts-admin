
const databaseUrl = process.env.DATABASE_URL ?? ""
const prismaConfig = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
}

export default prismaConfig
