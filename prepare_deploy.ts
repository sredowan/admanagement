
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
const DEPLOY_DIR = path.join(ROOT_DIR, 'deploy');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'public');
const PHP_DIR = path.join(ROOT_DIR, 'php');
const API_DIR = path.join(ROOT_DIR, 'public', 'api');

// Helper to copy directory recursive
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 1. Clean/Create Deploy Dir
if (fs.existsSync(DEPLOY_DIR)) {
    fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DEPLOY_DIR);

console.log("Preparing deployment folder...");

// 2. Copy Frontend Build (dist/public -> deploy)
if (fs.existsSync(DIST_DIR)) {
    console.log("Copying Frontend...");
    copyDir(DIST_DIR, DEPLOY_DIR);
} else {
    console.error("Error: dist/public not found. Run 'npm run build' first.");
    process.exit(1);
}

// 3. Copy PHP Core (php -> deploy/php)
console.log("Copying PHP Core...");
copyDir(PHP_DIR, path.join(DEPLOY_DIR, 'php'));

// 4. Copy API Endpoints (public/api -> deploy/api)
console.log("Copying API...");
copyDir(API_DIR, path.join(DEPLOY_DIR, 'api'));

// 5. Create Root .htaccess for SPA Routing
const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # API requests should populate normally
  RewriteRule ^api/ - [L,NC]

  # Sub-directory for assets
  RewriteRule ^assets/ - [L,NC]

  # If the request is a file or folder, ignore
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Otherwise redirect to index.html (React Router)
  RewriteRule . index.html [L]
</IfModule>`;

fs.writeFileSync(path.join(DEPLOY_DIR, '.htaccess'), htaccessContent);

// 6. Fix Import Paths (../../php -> ../php)
console.log("Fixing PHP Import Paths...");
const apiFiles = fs.readdirSync(path.join(DEPLOY_DIR, 'api'));
for (const file of apiFiles) {
    if (file.endsWith('.php')) {
        const filePath = path.join(DEPLOY_DIR, 'api', file);
        let content = fs.readFileSync(filePath, 'utf8');

        // Replace source relative path with prod relative path
        if (content.includes('../../php/')) {
            content = content.replace(/\.\.\/\.\.\/php\//g, '../php/');
            fs.writeFileSync(filePath, content);
            console.log(`Updated paths in ${file}`);
        }
    }
}

console.log("Deployment bundle created in /deploy");
console.log("Upload the contents of 'deploy' to your Hostinger public_html folder.");
