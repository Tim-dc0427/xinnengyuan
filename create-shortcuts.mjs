import { execSync } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { unlinkSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const desktop = join(homedir(), 'Desktop');
const proj = dirname(fileURLToPath(import.meta.url));

function createShortcut(name, batFile, iconIdx) {
  const lnkPath = join(desktop, name);
  const batFullPath = join(proj, batFile);

  // Point shortcut directly to .bat file (no cmd /c wrapper needed)
  const psCmd = [
    `$ws = New-Object -ComObject WScript.Shell`,
    `$s = $ws.CreateShortcut('${lnkPath.replace(/\\/g, '\\\\')}')`,
    `$s.TargetPath = '${batFullPath.replace(/\\/g, '\\\\')}'`,
    `$s.WorkingDirectory = '${proj.replace(/\\/g, '\\\\')}'`,
    `$s.IconLocation = "$env:SystemRoot\\System32\\imageres.dll,${iconIdx}"`,
    `$s.Save()`
  ].join(';');

  // Debug: show the actual paths being written
  console.log(`Creating: ${name}`);
  console.log(`  Target: ${batFullPath}`);
  console.log(`  WorkDir: ${proj}`);

  const b64 = Buffer.from(psCmd, 'utf16le').toString('base64');
  execSync(`powershell -NoProfile -EncodedCommand ${b64}`, { encoding: 'utf8', stdio: 'pipe' });

  // Verify: read back the .lnk and check for the path in binary
  const raw = readFileSync(lnkPath);
  // Look for "start.bat" or "stop.bat" string in the binary
  const batMarker = Buffer.from(batFile, 'utf16le');
  const found = raw.includes(batMarker);
  console.log(`  Verified: ${found ? 'OK' : 'FAIL - bat file name not found in .lnk'}`);
  return found;
}

// Delete old shortcuts
for (const f of ['新能源启动.lnk', '新能源停止.lnk']) {
  try { unlinkSync(join(desktop, f)); } catch(e) {}
}

const r1 = createShortcut('新能源启动.lnk', 'start.bat', 108);
const r2 = createShortcut('新能源停止.lnk', 'stop.bat', 95);

if (r1 && r2) {
  console.log('\nDone — 桌面快捷方式创建成功');
} else {
  console.log('\nFAIL — 创建失败，请运行 create-shortcuts.bat 代替');
}
