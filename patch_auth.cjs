const fs = require('fs');
let code = fs.readFileSync('src/controllers/authController.ts', 'utf8');

const oldQuery = `SELECT u.id, u.username, u.password_hash, u.full_name, u.student_id, u.title 
        FROM users u
        LEFT JOIN students s ON u.student_id = s.id
        WHERE (u.username = $1 OR s.phone_number = $1) AND u.role = 'STUDENT'`;

const newQuery = `SELECT u.id, u.username, u.password_hash, u.full_name, u.student_id, u.title 
        FROM users u
        LEFT JOIN students s ON u.student_id = s.id
        WHERE (u.username = $1 OR s.phone_number = $1) AND u.role = 'STUDENT'
        UNION
        SELECT s.id, s.username, s.password as password_hash, s.full_name, s.id as student_id, 'Học sinh' as title
        FROM students s
        WHERE (s.username = $1 OR s.phone_number = $1) AND s.password IS NOT NULL`;

code = code.replace(oldQuery, newQuery);

fs.writeFileSync('src/controllers/authController.ts', code);
console.log('Fixed authController');
