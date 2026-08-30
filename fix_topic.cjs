const fs = require('fs');

// 1. Fix analyticsController.ts
const acPath = 'src/controllers/analyticsController.ts';
let acCode = fs.readFileSync(acPath, 'utf8');
acCode = acCode.replace('stp.topic,', 'stp.topic_name AS topic,');
acCode = acCode.replace('GROUP BY stp.topic', 'GROUP BY stp.topic_name');
fs.writeFileSync(acPath, acCode);
console.log('Fixed analyticsController.ts');

// 2. Fix reportController.ts
const rcPath = 'src/controllers/reportController.ts';
let rcCode = fs.readFileSync(rcPath, 'utf8');
rcCode = rcCode.replace('SELECT topic, accuracy_rate', 'SELECT topic_name AS topic, accuracy_rate');
fs.writeFileSync(rcPath, rcCode);
console.log('Fixed reportController.ts');

