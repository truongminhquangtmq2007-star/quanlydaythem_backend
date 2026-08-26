const fs = require('fs');
let code = fs.readFileSync('src/routes/classRoutes.ts', 'utf8');

const imports = `import { getAssignableDocuments, assignDocumentsToClass } from '../controllers/classDocumentController';\n`;

code = code.replace("import { getClassAssignments } from '../controllers/assignmentController';", imports + "import { getClassAssignments } from '../controllers/assignmentController';");

const newRoutes = `
router.get('/:id/assignable-documents', verifyToken, getAssignableDocuments);
router.post('/:id/assign-documents', verifyToken, assignDocumentsToClass);
`;

code = code.replace("export default router;", newRoutes + "\nexport default router;");

fs.writeFileSync('src/routes/classRoutes.ts', code);
console.log("Patched classRoutes.");

