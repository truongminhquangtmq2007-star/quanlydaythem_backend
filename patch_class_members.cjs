const fs = require('fs');
const files = [
  'src/controllers/analyticsController.ts',
  'src/controllers/classController.ts',
  'src/controllers/reportController.ts',
  'src/controllers/sessionController.ts',
  'src/controllers/classDocumentController.ts'
];

let replacedCount = 0;

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/class_members/g);
    if (matches) {
      replacedCount += matches.length;
      content = content.replace(/class_members/g, 'enrollments');
      fs.writeFileSync(file, content);
    }
  }
}

console.log(`Replaced \${replacedCount} occurrences of class_members with enrollments.`);

