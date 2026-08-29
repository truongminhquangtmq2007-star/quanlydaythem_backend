const fs = require('fs');
let code = fs.readFileSync('src/middleware/uploadMiddleware.ts', 'utf8');

const filter = `
const fileFilter = (req: any, file: any, cb: any) => {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPG, PNG and DOCX are allowed.'));
    }
};
`;

// It might be hard to match the exact multiline string because of whitespace, so I'll just regex replace it
code = code.replace(/const fileFilter = \([\s\S]*?};\n/, '');
code = code.replace('const cloudStorage = new CloudinaryStorage({', filter + '\nconst cloudStorage = new CloudinaryStorage({');

fs.writeFileSync('src/middleware/uploadMiddleware.ts', code);
console.log('Fixed uploadMiddleware position!');

