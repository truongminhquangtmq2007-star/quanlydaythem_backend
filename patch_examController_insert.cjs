const fs = require('fs');
let code = fs.readFileSync('src/controllers/examController.ts', 'utf8');

const oldBlock = `          let actual_document_id = document_id;
          if (!actual_document_id) {
              const docRes = await pool.query(
                  \`INSERT INTO documents (document_code, title, file_url, category, type) VALUES ($1, $2, $3, 'EXAM', 'EXAM') RETURNING id\`,
                  [\`EXAM\${Date.now().toString().slice(-6)}\`, file.originalname || 'Đề thi tự động tạo', file.path]
              );
              actual_document_id = docRes.rows[0].id;
          }`;

const newBlock = `          let actual_document_id = document_id;
          if (!actual_document_id) {
              let folderId = null;
              if (class_id) {
                  const folderCheck = await pool.query("SELECT id FROM folders WHERE class_id = $1 AND category = 'EXAM'", [class_id]);
                  if (folderCheck.rows.length > 0) {
                      folderId = folderCheck.rows[0].id;
                  } else {
                      const newFolder = await pool.query(
                          "INSERT INTO folders (name, category, class_id) VALUES ('Đề thi', 'EXAM', $1) RETURNING id",
                          [class_id]
                      );
                      folderId = newFolder.rows[0].id;
                  }
              }

              const docRes = await pool.query(
                  \`INSERT INTO documents (title, file_url, category, folder_id, class_id) VALUES ($1, $2, 'EXAM', $3, $4) RETURNING id\`,
                  [file.originalname || 'Đề thi tự động tạo', file.path, folderId, class_id || null]
              );
              actual_document_id = docRes.rows[0].id;
          }`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/controllers/examController.ts', code);
console.log("Patched document insert logic.");
