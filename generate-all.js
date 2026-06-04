#!/usr/bin/env node

/**
 * Master Project Generator
 * Runs all generation scripts and creates the complete project structure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║   TCG IBERIA PROJECT GENERATOR                         ║');
console.log('║   Building production-ready ecommerce MVP              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const scripts = [
  'generate-project.js',
  'generate-app-files.js',
  'generate-components.js',
];

let allSuccess = true;

for (const script of scripts) {
  const scriptPath = path.join(__dirname, script);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ ${script} not found`);
    allSuccess = false;
    continue;
  }

  try {
    console.log(`\n▶ Running ${script}...`);
    const output = execSync(`node "${scriptPath}"`, {
      cwd: __dirname,
      encoding: 'utf-8',
    });
    console.log(output);
  } catch (error) {
    console.error(`❌ Failed to run ${script}`);
    console.error(error.message);
    allSuccess = false;
  }
}

if (allSuccess) {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   ✅ PROJECT GENERATION COMPLETE!                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 Next Steps:\n');
  console.log('1. 📝 Create .env.local with your configuration:');
  console.log('   cp .env.example .env.local\n');
  
  console.log('2. 🗄️  Setup Supabase:');
  console.log('   - Create a Supabase project');
  console.log('   - Copy your DATABASE_URL to .env.local\n');
  
  console.log('3. ☁️  Configure AWS S3:');
  console.log('   - Create S3 bucket');
  console.log('   - Create IAM user with S3 permissions');
  console.log('   - Add AWS credentials to .env.local\n');
  
  console.log('4. 📦 Install dependencies:');
  console.log('   npm install\n');
  
  console.log('5. 🔧 Setup Prisma:');
  console.log('   npm run prisma:generate');
  console.log('   npm run prisma:migrate\n');
  
  console.log('6. 🚀 Start development:');
  console.log('   npm run dev\n');
  
  console.log('7. 🔐 Access admin panel:');
  console.log('   http://localhost:3000/admin\n');
} else {
  console.error('\n❌ Some generation scripts failed. Please check the errors above.');
  process.exit(1);
}
