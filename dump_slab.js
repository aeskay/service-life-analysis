const fs = require('fs');
const content = fs.readFileSync('electron/main.js', 'utf8');
const lines = content.split('\n');
let start = -1, end = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('ipcMain.handle(\'run-survival-analysis-slab\'') && start===-1) {
    start = i;
  } else if (start !== -1 && lines[i].includes('// ─── IPC: Survival Analysis by Base Thickness ────────────────────────────────')) {
    end = i;
    break;
  }
}
console.log(lines.slice(start, end).join('\n'));
