const fs = require('fs');
const path = require('path');

const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const migrationDir = path.join(__dirname, 'prisma', 'migrations', `${timestamp}_add_product_type`);

// Create directory if it doesn't exist
if (!fs.existsSync(migrationDir)) {
  fs.mkdirSync(migrationDir, { recursive: true });
  console.log(`Created migration directory: ${migrationDir}`);
}

// Create migration.sql file
const migrationSql = `-- AlterTable
ALTER TABLE "Product" ADD COLUMN "type" VARCHAR(100);
`;

const migrationFile = path.join(migrationDir, 'migration.sql');
fs.writeFileSync(migrationFile, migrationSql);
console.log(`Created migration file: ${migrationFile}`);
