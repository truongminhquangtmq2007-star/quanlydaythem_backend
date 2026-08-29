const fs = require('fs');
let code = fs.readFileSync('src/controllers/classController.ts', 'utf8');

code = code.replace(/req: Request/g, 'req: AuthRequest');

const checkOwnershipStr = `
    const user = req.user;
    if (user?.role === 'TEACHER') {
      const checkClassId = req.params.id;
      const check = await pool.query('SELECT id FROM classes WHERE id = $1 AND teacher_id = $2', [checkClassId, user.id]);
      if (check.rows.length === 0) {
        res.status(403).json({ message: "Bạn không có quyền quản lý lớp này" });
        return;
      }
    }
`;

function injectCheck(funcName) {
    const regex = new RegExp(`(export const ${funcName} = async[^\\{]*\\{[\\s\\S]*?try\\s*\\{)`);
    // Use a function callback so $1, $2 in checkOwnershipStr are treated as literals
    code = code.replace(regex, (match, p1) => {
        return p1 + checkOwnershipStr;
    });
}

injectCheck('assignTeacher');
injectCheck('addMember');
injectCheck('createSession');
injectCheck('getClassMembers');
injectCheck('getClassSessions');

fs.writeFileSync('src/controllers/classController.ts', code);
console.log('Fixed more class IDORs properly!');

