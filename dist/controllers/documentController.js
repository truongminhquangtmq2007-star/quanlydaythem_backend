"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDrive = exports.getAllDocuments = exports.deleteDocument = exports.updateDocument = exports.addDocument = exports.getFolderContents = exports.deleteFolder = exports.updateFolder = exports.createFolder = void 0;
const db_1 = __importDefault(require("../db"));
// ---------------------------------------------------------
// FOLDERS API
// ---------------------------------------------------------
const createFolder = async (req, res) => {
    try {
        const { name, parent_id, category } = req.body;
        const user = req.user;
        if (!category || !['STORAGE', 'EXAM'].includes(category)) {
            res.status(400).json({ error: 'category bắt buộc là STORAGE hoặc EXAM' });
            return;
        }
        if (parent_id && user?.role === 'TEACHER') {
            const parentCheck = await db_1.default.query('SELECT id FROM folders WHERE id = $1 AND teacher_id = $2', [parent_id, user.id]);
            if (parentCheck.rows.length === 0) {
                res.status(403).json({ error: 'Không có quyền tạo thư mục trong thư mục cha này' });
                return;
            }
        }
        const result = await db_1.default.query('INSERT INTO folders (name, parent_id, category, teacher_id, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *', [name, parent_id || null, category, user?.id || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Lỗi createFolder:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
};
exports.createFolder = createFolder;
const updateFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM folders WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ error: 'Không có quyền sửa thư mục này' });
                return;
            }
        }
        const result = await db_1.default.query('UPDATE folders SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        console.error('Lỗi updateFolder:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
};
exports.updateFolder = updateFolder;
const deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM folders WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ error: 'Không có quyền xóa thư mục này' });
                return;
            }
        }
        await db_1.default.query('DELETE FROM folders WHERE id = $1', [id]);
        res.status(200).json({ message: 'Đã xóa thư mục' });
    }
    catch (error) {
        console.error('Lỗi deleteFolder:', error);
        res.status(500).json({ error: 'Lỗi server (Có thể thư mục không trống)' });
    }
};
exports.deleteFolder = deleteFolder;
// ---------------------------------------------------------
// DOCUMENTS API
// ---------------------------------------------------------
const getFolderContents = async (req, res) => {
    try {
        const { folderId } = req.params;
        const user = req.user;
        // root is "0" or "root" or null. Let's handle '0' or 'null'
        const isRoot = !folderId || folderId === '0' || folderId === 'null' || folderId === 'root';
        if (!isRoot && user?.role === 'TEACHER') {
            const checkFolder = await db_1.default.query('SELECT id FROM folders WHERE id = $1 AND teacher_id = $2', [folderId, user.id]);
            if (checkFolder.rows.length === 0) {
                res.status(403).json({ error: 'Bạn không có quyền xem thư mục này' });
                return;
            }
        }
        let foldersQuery;
        let docsQuery;
        let params = [];
        if (user?.role === 'ADMIN') {
            if (isRoot) {
                foldersQuery = 'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name';
                docsQuery = 'SELECT * FROM documents WHERE folder_id IS NULL ORDER BY title';
            }
            else {
                foldersQuery = 'SELECT * FROM folders WHERE parent_id = $1 ORDER BY name';
                docsQuery = 'SELECT * FROM documents WHERE folder_id = $1 ORDER BY title';
                params = [folderId];
            }
        }
        else {
            // TEACHER: strictly isolate by teacher_id
            if (isRoot) {
                foldersQuery = 'SELECT * FROM folders WHERE parent_id IS NULL AND teacher_id = $1 ORDER BY name';
                docsQuery = 'SELECT * FROM documents WHERE folder_id IS NULL AND teacher_id = $1 ORDER BY title';
                params = [user?.id];
            }
            else {
                foldersQuery = 'SELECT * FROM folders WHERE parent_id = $1 AND teacher_id = $2 ORDER BY name';
                docsQuery = 'SELECT * FROM documents WHERE folder_id = $1 AND teacher_id = $2 ORDER BY title';
                params = [folderId, user?.id];
            }
        }
        const foldersRes = await db_1.default.query(foldersQuery, params);
        const docsRes = await db_1.default.query(docsQuery, params);
        res.status(200).json({
            folders: foldersRes.rows,
            documents: docsRes.rows
        });
    }
    catch (error) {
        console.error('Lỗi getFolderContents:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
};
exports.getFolderContents = getFolderContents;
const addDocument = async (req, res) => {
    try {
        const { title, file_url, folder_id, category } = req.body;
        const user = req.user;
        const teacherId = user?.id;
        const docCategory = category || 'STORAGE';
        if (folder_id && user?.role === 'TEACHER') {
            const folderCheck = await db_1.default.query('SELECT id FROM folders WHERE id = $1 AND teacher_id = $2', [folder_id, user.id]);
            if (folderCheck.rows.length === 0) {
                res.status(403).json({ error: 'Không có quyền thêm tài liệu vào thư mục này' });
                return;
            }
        }
        const result = await db_1.default.query('INSERT INTO documents (title, file_url, folder_id, category, teacher_id, uploaded_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *', [title, file_url, folder_id || null, docCategory, teacherId || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Lỗi addDocument:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
};
exports.addDocument = addDocument;
const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, folder_id } = req.body;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const docCheck = await db_1.default.query('SELECT id FROM documents WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (docCheck.rows.length === 0) {
                res.status(403).json({ error: 'Không có quyền sửa tài liệu này' });
                return;
            }
            if (folder_id) {
                const targetFolderCheck = await db_1.default.query('SELECT id FROM folders WHERE id = $1 AND teacher_id = $2', [folder_id, user.id]);
                if (targetFolderCheck.rows.length === 0) {
                    res.status(403).json({ error: 'Không có quyền di chuyển tài liệu vào thư mục đích của giáo viên khác' });
                    return;
                }
            }
        }
        const result = await db_1.default.query('UPDATE documents SET title = $1, folder_id = $2 WHERE id = $3 RETURNING *', [title, folder_id || null, id]);
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        console.error('Lỗi updateDocument:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
};
exports.updateDocument = updateDocument;
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (user?.role === 'TEACHER') {
            const check = await db_1.default.query('SELECT id FROM documents WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            if (check.rows.length === 0) {
                res.status(403).json({ error: 'Không có quyền xóa tài liệu/đề thi này' });
                return;
            }
        }
        try {
            await db_1.default.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
        }
        catch (e) { }
        // Check if document has student submissions
        const subCheck = await db_1.default.query('SELECT id FROM exam_submissions WHERE document_id = $1 LIMIT 1', [id]);
        if (subCheck.rows.length > 0) {
            // Soft-delete to preserve student exam attempt history
            await db_1.default.query('UPDATE documents SET is_active = FALSE WHERE id = $1', [id]);
        }
        else {
            // Hard-delete if no submissions exist
            await db_1.default.query('DELETE FROM assignments WHERE document_id = $1', [id]);
            await db_1.default.query('DELETE FROM exam_keys WHERE document_id = $1', [id]);
            await db_1.default.query('DELETE FROM questions WHERE quiz_id = $1', [id]);
            await db_1.default.query('DELETE FROM documents WHERE id = $1', [id]);
        }
        res.status(200).json({ message: 'Đã xóa tài liệu/đề thi thành công' });
    }
    catch (error) {
        console.error('Lỗi deleteDocument:', error);
        res.status(500).json({ error: 'Lỗi server khi xóa tài liệu/đề thi' });
    }
};
exports.deleteDocument = deleteDocument;
const getAllDocuments = async (req, res) => {
    try {
        const user = req.user;
        let result;
        if (user?.role === 'ADMIN') {
            result = await db_1.default.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
        }
        else {
            result = await db_1.default.query('SELECT * FROM documents WHERE teacher_id = $1 ORDER BY uploaded_at DESC', [user?.id]);
        }
        res.json(result.rows);
    }
    catch (e) {
        res.status(500).json({ message: 'Lỗi' });
    }
};
exports.getAllDocuments = getAllDocuments;
const getDrive = async (req, res) => {
    try {
        const { category, class_id } = req.query;
        let foldersQuery = 'SELECT f.* FROM folders f ';
        let docsQuery = 'SELECT d.* FROM documents d ';
        const params = [];
        let paramIdx = 1;
        if (req.user && req.user.role === 'TEACHER') {
            foldersQuery += ' LEFT JOIN classes c ON f.class_id = c.id WHERE (f.teacher_id = $' + paramIdx + ' OR c.teacher_id = $' + paramIdx + ') ';
            docsQuery += ' LEFT JOIN folders fd ON d.folder_id = fd.id LEFT JOIN classes c2 ON fd.class_id = c2.id WHERE (d.teacher_id = $' + paramIdx + ' OR c2.teacher_id = $' + paramIdx + ') ';
            params.push(req.user.id);
            paramIdx++;
        }
        else {
            foldersQuery += ' WHERE 1=1 ';
            docsQuery += ' WHERE 1=1 ';
        }
        if (category) {
            foldersQuery += ` AND f.category = $${paramIdx}`;
            docsQuery += ` AND d.category = $${paramIdx}`;
            params.push(category);
            paramIdx++;
        }
        if (class_id) {
            foldersQuery += ` AND f.class_id = $${paramIdx}`;
            docsQuery += ` AND d.folder_id IN (SELECT id FROM folders WHERE class_id = $${paramIdx})`;
            params.push(class_id);
            paramIdx++;
        }
        const foldersRes = await db_1.default.query(foldersQuery, params);
        const docsRes = await db_1.default.query(docsQuery, params);
        res.status(200).json({
            folders: foldersRes.rows,
            documents: docsRes.rows
        });
    }
    catch (error) {
        console.error('Lỗi getDrive:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
};
exports.getDrive = getDrive;
//# sourceMappingURL=documentController.js.map