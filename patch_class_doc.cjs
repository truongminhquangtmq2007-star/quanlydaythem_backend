const fs = require('fs');
let code = fs.readFileSync('src/controllers/classDocumentController.ts', 'utf8');

code = code.replace(
  "SELECT d.id, d.title, d.category, d.folder_id, f.name AS folder_name, f.class_id AS folder_class_id",
  "SELECT d.id, d.title, d.category, d.folder_id, d.file_url, d.uploaded_at AS created_at, f.name AS folder_name, f.class_id AS folder_class_id"
);

fs.writeFileSync('src/controllers/classDocumentController.ts', code);
console.log("Patched classDocumentController.ts");
