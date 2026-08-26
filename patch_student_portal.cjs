const fs = require('fs');
let code = fs.readFileSync('src/controllers/studentPortalController.ts', 'utf8');

// Update getDashboard to select email
code = code.replace(
  '"SELECT id, full_name, phone_number AS phone, school_name AS school FROM students WHERE id = $1"',
  '"SELECT id, full_name, email, phone_number AS phone, school_name AS school FROM students WHERE id = $1"'
);

// Add updateEmail endpoint
const newEndpoint = `
export const updateEmail = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.student_id;
        if (!studentId) {
            res.status(403).json({ message: 'Không có quyền' });
            return;
        }
        const { email } = req.body;
        
        // Basic validation
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({ message: 'Email không hợp lệ' });
            return;
        }

        await pool.query('UPDATE students SET email = $1 WHERE id = $2', [email || null, studentId]);
        res.status(200).json({ message: 'Cập nhật email thành công' });
    } catch (error) {
        console.error("LỖI updateEmail:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
`;

if (!code.includes('export const updateEmail')) {
    code += newEndpoint;
}

fs.writeFileSync('src/controllers/studentPortalController.ts', code);
console.log("Patched studentPortalController.");
