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
        if (!category || !['STORAGE', 'EXAM'].includes(category)) {
            res.status(400).json({ error: 'category bắt buộc là STORAGE hoặc EXAM' });
            return;
        }
        const result = await db_1.default.query('INSERT INTO folders (name, parent_id, category, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *', [name, parent_id || null, category]);
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
        // root is "0" or "root" or null. Let's handle '0' or 'null'
        let parentCond = "parent_id IS NULL";
        let folderCond = "folder_id IS NULL";
        let params = [];
        if (folderId && folderId !== '0' && folderId !== 'null' && folderId !== 'root') {
            parentCond = "parent_id = $1";
            folderCond = "folder_id = $1";
            params = [folderId];
        }
        const foldersRes = await db_1.default.query(`SELECT * FROM folders WHERE ${parentCond} ORDER BY name`, params);
        const docsRes = await db_1.default.query(`SELECT * FROM documents WHERE ${folderCond} ORDER BY title`, params);
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
        const teacherId = req.user?.id;
        const docCategory = category || 'STORAGE';
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
        await db_1.default.query('DELETE FROM documents WHERE id = $1', [id]);
        res.status(200).json({ message: 'Đã xóa tài liệu' });
    }
    catch (error) {
        console.error('Lỗi deleteDocument:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
};
exports.deleteDocument = deleteDocument;
const getAllDocuments = async (req, res) => {
    // Original method fallback just in case
    try {
        const result = await db_1.default.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
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
        // Just a placeholder to return folders and docs matching conditions
        let foldersQuery = 'SELECT f.* FROM folders f ';
        let docsQuery = 'SELECT d.* FROM documents d ';
        const params = [];
        let paramIdx = 1;
        if (req.user && req.user.role === 'TEACHER') {
            foldersQuery += ' LEFT JOIN classes c ON f.class_id = c.id WHERE (c.teacher_id = $' + paramIdx + ') ';
            docsQuery += ' LEFT JOIN folders fd ON d.folder_id = fd.id LEFT JOIN classes c2 ON fd.class_id = c2.id WHERE (c2.teacher_id = $' + paramIdx + ' OR d.teacher_id = $' + paramIdx + ') ';
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