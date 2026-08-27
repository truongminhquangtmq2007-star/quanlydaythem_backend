const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

// I will fix the questions insertion catch block
const oldCatchBlock = /\} catch \(error: any\) \{\s*res\.status\(500\)\.json\(\{ message: "Lỗi lưu cơ sở dữ liệu: " \+ error\.message \}\);\s*\}/;
const newCatchBlock = `} catch (error: any) {
            res.status(500).json({ message: "Lỗi lưu cơ sở dữ liệu: " + error.message });
            return;
        }`;

code = code.replace(oldCatchBlock, newCatchBlock);

// I will also check the first AI catch block (aiError)
const oldAiCatchBlock = /catch \(aiError: any\) \{[\s\S]*?res\.status\(200\)\.json\(\{[\s\S]*?\}\);\s*\}/;
// Wait, the aiError catch block might be missing a `return;` if I removed it?
// Let's just manually fix the end of parseExamFromFile.

// Actually, I just need to make sure the specific catch block for database insertion has `return;`
fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Patched catch block return");

