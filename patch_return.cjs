const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');
code = code.replace("res.status(200).json({ status: 'success', data: resultData });", "return res.status(200).json({ status: 'success', data: resultData });");
fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Added return to res.status(200)");
