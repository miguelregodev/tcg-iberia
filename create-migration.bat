@echo off
REM Create migration directory
md "c:\Users\Rego_\tcg-iberia\tcg-iberia\tcg-iberia\prisma\migrations\20260604223151_add_product_type" 2>nul

REM Create migration.sql file
(
  echo -- AlterTable
  echo ALTER TABLE "Product" ADD COLUMN "type" VARCHAR(100);
) > "c:\Users\Rego_\tcg-iberia\tcg-iberia\tcg-iberia\prisma\migrations\20260604223151_add_product_type\migration.sql"

echo Migration files created successfully
