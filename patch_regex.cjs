const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

code = code.replace("const regex = /(CAus+d+[:.])/gi;", "const regex = /(C[âa]u\\s+\\d+[:\\.])|([Bb]ài\\s+\\d+[:\\.])/gi;");
code = code.replace("const regex = /(Câu\\s+\\d+[:\\.])/gi;", "const regex = /(C[âa]u\\s+\\d+[:\\.])|([Bb]ài\\s+\\d+[:\\.])/gi;");

fs.writeFileSync('src/services/geminiService.ts', code);
console.log("Patched regex in geminiService");

