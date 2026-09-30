const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const tmpDir     = os.tmpdir();
const scriptPath = path.join(tmpDir, 'survival_script_test.py');
const resultPath = path.join(tmpDir, 'survival_result_test.json');
const statePath  = 'C:\\Users\\Samuel Alalade\\OneDrive - Texas Tech University\\Research\\PhD\\0-7147\\Tasks\\Task 6\\New Data\\service-life-analysis\\.app-state\\split_progress.json';

const pyCode = `import sys, json, traceback
RESULT_PATH = sys.argv[1]
print('Hello from python, result_path:', RESULT_PATH)
try:
    with open(RESULT_PATH, 'w') as f:
        json.dump({'status': 'ok'}, f)
except Exception as e:
    print('error:', e)
`
fs.writeFileSync(scriptPath, pyCode, 'utf8');

const pythonCmd = 'C:\\Users\\Samuel Alalade\\anaconda3\\python.exe';
const res = spawnSync(pythonCmd, [scriptPath, resultPath, statePath]);

console.log('stdout:', res.stdout ? res.stdout.toString() : '');
console.log('stderr:', res.stderr ? res.stderr.toString() : '');
console.log('status:', res.status);
console.log('exists:', fs.existsSync(resultPath));
