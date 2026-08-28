const fs = require('fs');

const code = fs.readFileSync('src/controllers/examController.ts', 'utf8');
const newPublish = fs.readFileSync('new_publish_exam.ts', 'utf8');

const regex = /export const publishExam = async \(req: AuthRequest, res: Response\): Promise<void> => \{[\s\S]*?res\.status\(500\)\.json\(\{ message: 'Lỗi xuất bản đề thi' \}\);\s*\}\s*\};/u;

// Backup in case regex fails due to encoding
const backupRegex = /export const publishExam = async \(req: AuthRequest, res: Response\): Promise<void> => \{[\s\S]*?res\.status\(500\)\.json\(\{ message: 'L.*?xu.*?t b.*?n .*? thi' \}\);\s*\}\s*\};/u;


if (code.match(regex)) {
    const newCode = code.replace(regex, newPublish);
    fs.writeFileSync('src/controllers/examController.ts', newCode);
    console.log("Patched examController.ts using main regex");
} else if (code.match(backupRegex)) {
    const newCode = code.replace(backupRegex, newPublish);
    fs.writeFileSync('src/controllers/examController.ts', newCode);
    console.log("Patched examController.ts using backup regex");
} else {
    console.log("Failed to match publishExam");
    // Print a bit of the file for debug
    console.log(code.substring(code.indexOf("publishExam"), code.indexOf("publishExam") + 500));
}

