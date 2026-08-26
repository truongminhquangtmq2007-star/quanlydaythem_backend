const fs = require('fs');
let code = fs.readFileSync('src/controllers/studentPortalController.ts', 'utf8');

// Modify the query in getDocuments to not restrict to EXAM and use f.category as type
code = code.replace(
  "SELECT d.id, d.title, 'EXAM' AS type, d.file_url, d.uploaded_at AS created_at, c.class_name, NULL AS due_at\n  FROM documents d\n  JOIN folders f ON d.folder_id = f.id\n  JOIN classes c ON f.class_id = c.id\n  JOIN enrollments e ON e.class_id = c.id\n  WHERE e.student_id = $1 AND f.category = 'EXAM'",
  "SELECT d.id, d.title, f.category AS type, d.file_url, d.uploaded_at AS created_at, c.class_name, NULL AS due_at\n  FROM documents d\n  JOIN folders f ON d.folder_id = f.id\n  JOIN classes c ON f.class_id = c.id\n  JOIN enrollments e ON e.class_id = c.id\n  WHERE e.student_id = $1"
);

// Fallback if formatting was different
if (!code.includes("f.category AS type")) {
    code = code.replace(
      /SELECT d.id, d.title, 'EXAM' AS type, d.file_url, d.uploaded_at AS created_at, c.class_name, NULL AS due_at\s*FROM documents d\s*JOIN folders f ON d.folder_id = f.id\s*JOIN classes c ON f.class_id = c.id\s*JOIN enrollments e ON e.class_id = c.id\s*WHERE e.student_id = \$1 AND f.category = 'EXAM'/,
      "SELECT d.id, d.title, f.category AS type, d.file_url, d.uploaded_at AS created_at, c.class_name, NULL AS due_at\n  FROM documents d\n  JOIN folders f ON d.folder_id = f.id\n  JOIN classes c ON f.class_id = c.id\n  JOIN enrollments e ON e.class_id = c.id\n  WHERE e.student_id = $1"
    );
}

// Same for getDashboard recent assignments list
code = code.replace(
  /SELECT d\.id, d\.title, 'EXAM' AS type, c\.class_name\s*FROM documents d\s*JOIN folders f ON d\.folder_id = f\.id\s*JOIN classes c ON f\.class_id = c\.id\s*JOIN enrollments e ON e\.class_id = c\.id\s*WHERE e\.student_id = \$1 AND f\.category = 'EXAM'/g,
  "SELECT d.id, d.title, f.category AS type, c.class_name\n  FROM documents d\n  JOIN folders f ON d.folder_id = f.id\n  JOIN classes c ON f.class_id = c.id\n  JOIN enrollments e ON e.class_id = c.id\n  WHERE e.student_id = $1"
);


fs.writeFileSync('src/controllers/studentPortalController.ts', code);
console.log("Patched studentPortalController.ts documents query");

