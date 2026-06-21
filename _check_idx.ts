import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
(async () => {
  const idx = await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename = 'Product' ORDER BY indexname`;
  console.log(idx);
  const ext = await db.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;
  console.log("extension:", ext);
  await db.$disconnect();
})();
