const fs = require('fs');
let code = fs.readFileSync('src/middleware/uploadMiddleware.ts', 'utf8');

const filter = `
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPG, PNG and DOCX are allowed.'));
    }
};
`;

code = code.replace('const memoryStorage = multer.memoryStorage();', filter + '\nconst memoryStorage = multer.memoryStorage();');
code = code.replace('export const uploadCloud = multer({ storage: cloudStorage });', 'export const uploadCloud = multer({ storage: cloudStorage, fileFilter });');
code = code.replace('export const uploadMemory = multer({ storage: memoryStorage });', 'export const uploadMemory = multer({ storage: memoryStorage, fileFilter });');

fs.writeFileSync('src/middleware/uploadMiddleware.ts', code);
console.log('Fixed uploadMiddleware file filtering!');

