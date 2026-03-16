const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '..', 'release', 'win-unpacked');
const pkg = require('../package.json');
const version = pkg.version;
const outZip = path.join(__dirname, '..', 'release', `DataShell-portable-win-x64-v${version}.zip`);

if (!fs.existsSync(srcDir)) {
  console.error('Önce "npm run dist:dir" çalıştır!');
  process.exit(1);
}

console.log(`Zip oluşturuluyor: ${outZip}`);

const cmd = `powershell -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${outZip}' -Force"`;
execSync(cmd, { stdio: 'inherit' });

console.log(`Hazır: ${outZip}`);
console.log(`   -> Başka PC'ye kopyala, unzip et, DataShell.exe'yi çalıştır.`);
