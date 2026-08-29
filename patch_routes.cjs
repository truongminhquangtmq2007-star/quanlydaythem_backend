const fs = require('fs');

let classRoutes = fs.readFileSync('src/routes/classRoutes.ts', 'utf8');
classRoutes = classRoutes.replace(/verifyToken, /g, 'verifyToken, isTeacherOrAdmin, ');
classRoutes = classRoutes.replace(/isTeacherOrAdmin, getClasses/g, 'getClasses'); // let getClasses handle its own logic
classRoutes = classRoutes.replace(/isTeacherOrAdmin, getClass/g, 'getClass'); // getClass checks inside
classRoutes = classRoutes.replace(/import \{ verifyToken, isAdmin \}/g, 'import { verifyToken, isAdmin, isTeacherOrAdmin }');
fs.writeFileSync('src/routes/classRoutes.ts', classRoutes);

let examRoutes = fs.readFileSync('src/routes/examRoutes.ts', 'utf8');
examRoutes = examRoutes.replace(/router\.post\('\/key', verifyToken, saveAnswerKey\);/, "router.post('/key', verifyToken, isTeacherOrAdmin, saveAnswerKey);");
examRoutes = examRoutes.replace(/router\.post\('\/parse-ai-text', verifyToken, createExamFromText\);/, "router.post('/parse-ai-text', verifyToken, isTeacherOrAdmin, createExamFromText);");
examRoutes = examRoutes.replace(/router\.post\('\/parse-ai-file', verifyToken, uploadMemory\.single\('examFile'\), parseExamFromFile\);/, "router.post('/parse-ai-file', verifyToken, isTeacherOrAdmin, uploadMemory.single('examFile'), parseExamFromFile);");
examRoutes = examRoutes.replace(/router\.get\('\/:document_id\/submissions', verifyToken, getExamSubmissions\);/, "router.get('/:document_id/submissions', verifyToken, isTeacherOrAdmin, getExamSubmissions);");
examRoutes = examRoutes.replace(/router\.get\('\/key\/:document_id', verifyToken, getExamKey\);/, "router.get('/key/:document_id', verifyToken, isTeacherOrAdmin, getExamKey);");
fs.writeFileSync('src/routes/examRoutes.ts', examRoutes);

console.log('Patched routes for Authorization!');

