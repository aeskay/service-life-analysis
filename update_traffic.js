const fs = require('fs');
const files = [
  'src/components/Traffic/TrafficWorkspace.jsx',
  'src/components/Traffic/TrafficDistributionWorkspace.jsx',
  'src/components/Traffic/TrafficServiceLifeWorkspace.jsx',
  'src/components/Traffic/TrafficSlabBaseWorkspace.jsx'
];
for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  
  // Standardize titles to 28
  content = content.replace(/title:\s*\{\s*text:\s*([^,]+),\s*font:\s*\{\s*size:\s*\d+\s*\}\s*\}/g, 'title: { text: $1, font: { size: 28 } }');
  
  // Standardize tickfonts to 22
  content = content.replace(/tickfont:\s*\{\s*size:\s*\d+\s*\}/g, 'tickfont: { size: 22 }');
  
  // Standardize textfonts (data labels) to 22
  content = content.replace(/textfont:\s*\{\s*color:\s*([^,]+),\s*size:\s*\d+(,\s*family:\s*'[^']+')?\s*\}/g, 'textfont: { color: $1, size: 22$2 }');
  content = content.replace(/textfont:\s*\{\s*size:\s*\d+(,\s*color:\s*'[^']+')?\s*\}/g, 'textfont: { size: 22$1 }');

  // Standardize margins
  content = content.replace(/margin:\s*\{\s*t:\s*\d+,\s*r:\s*\d+,\s*l:\s*\d+,\s*b:\s*\d+\s*\}/g, 'margin: { t: 40, r: 20, l: 100, b: 100 }');

  // Add tickangle: 0 to all tickfonts in xaxis to prevent slanting
  content = content.replace(/xaxis:\s*\{([\s\S]*?)tickfont:\s*\{\s*size:\s*22\s*\}/g, 'xaxis: {$1tickfont: { size: 22 }, tickangle: 0');

  // Legend fonts are a bit tricky, let's just do a blanket font size change for the legend block if it exists
  content = content.replace(/legend:\s*\{([^}]*?)font:\s*\{\s*size:\s*\d+\s*\}/g, 'legend: {$1font: { size: 22 }');

  fs.writeFileSync(f, content);
}
