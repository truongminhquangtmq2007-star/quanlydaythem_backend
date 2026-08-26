const fs = require('fs');
let code = fs.readFileSync('src/routes/sessionRoutes.ts', 'utf8');

code = code.replace(
  'import { getEvaluations, saveEvaluation, markSessionsAsBilled } from \'../controllers/sessionController\';',
  'import { getEvaluations, saveEvaluation, markSessionsAsBilled, syncCalendar } from \'../controllers/sessionController\';'
);

code = code.replace(
  'export default router;',
  'router.post(\'/:id/sync-calendar\', verifyToken, syncCalendar);\n\nexport default router;'
);

fs.writeFileSync('src/routes/sessionRoutes.ts', code);
console.log("Patched sessionRoutes.");

