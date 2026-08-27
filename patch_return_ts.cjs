const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');
code = code.replace(/return res\.status\(500\)\.json/g, "res.status(500).json");
code = code.replace(/return res\.status\(200\)\.json/g, "res.status(200).json");
fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Fixed return type");
