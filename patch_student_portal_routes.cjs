const fs = require('fs');
let code = fs.readFileSync('src/routes/studentPortalRoutes.ts', 'utf8');

code = code.replace(
  'import { getDashboard, getSchedule, getDocuments } from \'../controllers/studentPortalController\';',
  'import { getDashboard, getSchedule, getDocuments, updateEmail } from \'../controllers/studentPortalController\';'
);

code = code.replace(
  'router.get(\'/dashboard\', verifyToken, getDashboard);',
  'router.get(\'/dashboard\', verifyToken, getDashboard);\nrouter.put(\'/email\', verifyToken, updateEmail);'
);

fs.writeFileSync('src/routes/studentPortalRoutes.ts', code);
console.log("Patched studentPortalRoutes.");

