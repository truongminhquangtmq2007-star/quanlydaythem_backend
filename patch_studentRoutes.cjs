const fs = require('fs');
let code = fs.readFileSync('src/routes/studentRoutes.ts', 'utf8');

if (!code.includes('generateAIEvaluation')) {
    code = code.replace(/import \{([^}]+)\} from '\.\.\/controllers\/studentController';/, "import {$1, generateAIEvaluation } from '../controllers/studentController';");
    code = code.replace(/export default router;/, "router.post('/:id/ai-evaluation', verifyToken, generateAIEvaluation);\n\nexport default router;");
    fs.writeFileSync('src/routes/studentRoutes.ts', code);
    console.log('Patched studentRoutes.ts');
}

