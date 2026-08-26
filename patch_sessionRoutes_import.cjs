const fs = require('fs');
let code = fs.readFileSync('src/routes/sessionRoutes.ts', 'utf8');
code = code.replace("markSessionsAsBilled }", "markSessionsAsBilled, syncCalendar }");
fs.writeFileSync('src/routes/sessionRoutes.ts', code);
console.log("Patched sessionRoutes import");

