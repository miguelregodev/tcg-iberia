@echo off
REM Create directory structure and pages for the new routes

REM Create directories
if not exist "src\app\booster-boxes" mkdir "src\app\booster-boxes"
if not exist "src\app\booster-packs" mkdir "src\app\booster-packs"
if not exist "src\app\booster-bundles" mkdir "src\app\booster-bundles"

REM Create booster-boxes page
(
echo import { Navigation } from "@/components/Navigation";
echo import { ProductListPage } from "@/components/ProductListPage";
echo import { Footer } from "@/components/Footer";
echo.
echo interface PageProps {
echo   searchParams: Promise^<{ language?: string }^>;
echo }
echo.
echo export const metadata = {
echo   title: "Booster Boxes - TCG Iberia",
echo   description: "Browse our premium booster box collection in multiple languages",
echo };
echo.
echo export default async function BoosterBoxesPage({ searchParams }: PageProps^) {
echo   const params = await searchParams;
echo   const language = params.language as 'ENGLISH' ^| 'JAPANESE' ^| 'KOREAN' ^| 'SPANISH' ^| undefined;
echo.
echo   return (
echo     ^<^>
echo       ^<Navigation /^>
echo       ^<ProductListPage 
echo         title="Booster Boxes" 
echo         productType="booster box"
echo         language={language}
echo       /^>
echo       ^<Footer /^>
echo     ^</^>
echo   ^);
echo }
) > "src\app\booster-boxes\page.tsx"

REM Create booster-packs page
(
echo import { Navigation } from "@/components/Navigation";
echo import { ProductListPage } from "@/components/ProductListPage";
echo import { Footer } from "@/components/Footer";
echo.
echo interface PageProps {
echo   searchParams: Promise^<{ language?: string }^>;
echo }
echo.
echo export const metadata = {
echo   title: "Booster Packs - TCG Iberia",
echo   description: "Browse our premium booster pack collection in multiple languages",
echo };
echo.
echo export default async function BoosterPacksPage({ searchParams }: PageProps^) {
echo   const params = await searchParams;
echo   const language = params.language as 'ENGLISH' ^| 'JAPANESE' ^| 'KOREAN' ^| 'SPANISH' ^| undefined;
echo.
echo   return (
echo     ^<^>
echo       ^<Navigation /^>
echo       ^<ProductListPage 
echo         title="Booster Packs" 
echo         productType="pack"
echo         language={language}
echo       /^>
echo       ^<Footer /^>
echo     ^</^>
echo   ^);
echo }
) > "src\app\booster-packs\page.tsx"

REM Create booster-bundles page
(
echo import { Navigation } from "@/components/Navigation";
echo import { ProductListPage } from "@/components/ProductListPage";
echo import { Footer } from "@/components/Footer";
echo.
echo interface PageProps {
echo   searchParams: Promise^<{ language?: string }^>;
echo }
echo.
echo export const metadata = {
echo   title: "Booster Bundles - TCG Iberia",
echo   description: "Browse our premium booster bundle collection in multiple languages",
echo };
echo.
echo export default async function BoosterBundlesPage({ searchParams }: PageProps^) {
echo   const params = await searchParams;
echo   const language = params.language as 'ENGLISH' ^| 'JAPANESE' ^| 'KOREAN' ^| 'SPANISH' ^| undefined;
echo.
echo   return (
echo     ^<^>
echo       ^<Navigation /^>
echo       ^<ProductListPage 
echo         title="Booster Bundles" 
echo         productType="bundle"
echo         language={language}
echo       /^>
echo       ^<Footer /^>
echo     ^</^>
echo   ^);
echo }
) > "src\app\booster-bundles\page.tsx"

echo Routes created successfully!
pause
