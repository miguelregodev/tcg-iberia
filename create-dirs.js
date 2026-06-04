const fs = require('fs');
const path = require('path');

const dirs = [
  'c:\\Users\\Rego_\\tcg-iberia\\tcg-iberia\\tcg-iberia\\src\\app\\booster-boxes',
  'c:\\Users\\Rego_\\tcg-iberia\\tcg-iberia\\tcg-iberia\\src\\app\\booster-packs',
  'c:\\Users\\Rego_\\tcg-iberia\\tcg-iberia\\tcg-iberia\\src\\app\\booster-bundles',
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created: ${dir}`);
  }
});
