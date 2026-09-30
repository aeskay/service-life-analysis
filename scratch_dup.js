const fs = require('fs');
const src = 'src/components/AverageLife/SurvivalWorkspace.jsx';
const dest = 'src/components/Traffic/TrafficSurvivalWorkspace.jsx';
let content = fs.readFileSync(src, 'utf8');

// Replace component name
content = content.replace(/SurvivalWorkspace/g, 'TrafficSurvivalWorkspace');

// Replace API call
content = content.replace(/window\.electronAPI\.runSurvivalAnalysis\(\)/g, 'window.electronAPI.runSurvivalAnalysisTraffic()');

// Replace 'Age (Years)' with 'Cumulative ESAL (Millions)'
content = content.replace(/'<b>Age \(Years\)<\/b>'/g, "'<b>Cumulative ESAL (Millions)</b>'");

// Replace window.survivalDataCache with window.trafficSurvivalCache
content = content.replace(/window\.survivalDataCache/g, 'window.trafficSurvivalCache');

// Replace 'Kaplan-Meier survival analysis...' text
content = content.replace(/>Running Kaplan-Meier survival analysis...<\/div>/g, '>Running Kaplan-Meier survival analysis for Traffic...</div>');

// Replace title text
content = content.replace(/Survival Analysis \(Service Life\)/g, 'Survival Analysis (Traffic)');
content = content.replace(/Statistically rigorous service life estimation accounting for right-censored \(in-service\) pavements./g, 'Statistically rigorous survival estimation based on Cumulative ESAL accounting for right-censored (in-service) pavements.');

// We might want to fix the x-axis range since ESAL is in millions
// Let's remove dtick: 5 from the xaxis so it autoscales, since it's going up to ~100
content = content.replace(/dtick:\s*5,/g, '');

fs.writeFileSync(dest, content, 'utf8');
console.log('Created TrafficSurvivalWorkspace.jsx');
