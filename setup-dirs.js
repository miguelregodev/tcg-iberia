const fs = require('fs');
const path = require('path');

const dirs = [
  'prisma',
  'src/app/api/products',
  'src/app/api/admin/products',
  'src/app/admin/products',
  'src/app/admin/login',
  'src/app/product',
  'src/components',
  'src/lib',
  'src/services',
  'src/hooks',
  'src/types',
  'src/utils',
  'src/styles',
  'public',
];

const basePath = __dirname;

dirs.forEach(dir => {
  const fullPath = path.join(basePath, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created ${fullPath}`);
  }
});

console.log('All directories created successfully');
