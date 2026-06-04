@echo off
REM Setup script for TCG Iberia project (Windows)
REM Run this after cloning: setup.bat

setlocal enabledelayedexpansion

echo 🚀 Setting up TCG Iberia project...

REM Create directory structure
echo 📁 Creating directories...
if not exist prisma mkdir prisma
if not exist prisma\migrations mkdir prisma\migrations
if not exist src mkdir src
if not exist src\app mkdir src\app
if not exist src\components mkdir src\components
if not exist src\lib mkdir src\lib
if not exist src\services mkdir src\services
if not exist src\hooks mkdir src\hooks
if not exist src\types mkdir src\types
if not exist src\utils mkdir src\utils
if not exist src\styles mkdir src\styles
if not exist src\app\api mkdir src\app\api
if not exist src\app\admin mkdir src\app\admin
if not exist src\app\product mkdir src\app\product
if not exist src\app\api\products mkdir src\app\api\products
if not exist src\app\api\admin mkdir src\app\api\admin
if not exist src\app\api\admin\products mkdir src\app\api\admin\products
if not exist src\app\admin\products mkdir src\app\admin\products
if not exist src\app\admin\login mkdir src\app\admin\login
if not exist public mkdir public

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Generate Prisma client
echo 🔧 Generating Prisma client...
call npm run prisma:generate

echo.
echo ✅ Setup complete!
echo.
echo 📋 Next steps:
echo 1. Configure .env.local with your environment variables
echo 2. Set up Supabase database and get DATABASE_URL
echo 3. Configure AWS S3 bucket and credentials
echo 4. Run: npm run prisma:migrate
echo 5. Run: npm run dev
echo.
echo 🌐 Visit http://localhost:3000
echo 🔐 Admin: http://localhost:3000/admin
pause
