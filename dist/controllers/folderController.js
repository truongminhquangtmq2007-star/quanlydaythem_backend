"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDriveContents = exports.renameFolder = exports.createFolder = void 0;
const db_1 = __importDefault(require("../db")); // Nhớ trỏ đúng đường dẫn file DB của bạn
// 1. TẠO THƯ MỤC MỚI (Hỗ trợ cả thư mục gốc lẫn thư mục con)
const createFolder = async (req, res) => {
    try {
        const { name, category, class_id, parent_id } = req.body;
        // Nếu không truyền parent_id (tạo ở ngoài cùng), ta set là null
        const pId = parent_id ? parent_id : null;
        const result = await db_1.default.query(`INSERT INTO folders (name, category, class_id, parent_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`, [name, category, class_id, pId]);
        res.status(201).json({ message: "Đã tạo thư mục", folder: result.rows[0] });
    }
    catch (error) {
        console.error("Lỗi tạo thư mục:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};
exports.createFolder = createFolder;
// 2. ĐỔI TÊN THƯ MỤC
const renameFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_name } = req.body;
        const result = await db_1.default.query('UPDATE folders SET name = $1 WHERE id = $2 RETURNING *', [new_name, id]);
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Không tìm thấy thư mục" });
            return;
        }
        res.status(200).json({ message: "Đổi tên thành công", folder: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};
exports.renameFolder = renameFolder;
// 3. LẤY NỘI DUNG "DRIVE" (Gộp cả Thư mục con & File tài liệu vào 1 API)
const getDriveContents = async (req, res) => {
    try {
        const { category, class_id, parent_id } = req.query;
        // Truy vấn 1: Lấy các thư mục con
        let folderQuery = 'SELECT * FROM folders WHERE category = $1 AND class_id = $2';
        const folderParams = [category, class_id];
        if (parent_id) {
            folderQuery += ' AND parent_id = $3 ORDER BY id DESC';
            folderParams.push(parent_id);
        }
        else {
            folderQuery += ' AND parent_id IS NULL ORDER BY id DESC';
        }
        const foldersResult = await db_1.default.query(folderQuery, folderParams);
        // Truy vấn 2: Lấy File tài liệu (ĐÃ SỬA: JOIN với exam_keys để lấy cấu hình)
        // Nếu category là EXAM, ta LEFT JOIN để lấy thêm allow_view_answers và duration_minutes
        let docQuery = `
      SELECT d.*, ek.allow_view_answers, ek.duration_minutes 
      FROM documents d 
      LEFT JOIN exam_keys ek ON d.id = ek.document_id 
      WHERE d.category = $1 
    `;
        const docParams = [category];
        // Chỉ lọc theo class_id nếu cần, tùy vào cấu trúc bảng documents của bạn
        // docQuery += ' AND d.class_id = $2'; 
        // docParams.push(class_id);
        if (parent_id) {
            docQuery += ' AND d.folder_id = $' + (docParams.length + 1) + ' ORDER BY d.id DESC';
            docParams.push(parent_id);
        }
        else {
            docQuery += ' AND d.folder_id IS NULL ORDER BY d.id DESC';
        }
        const docsResult = await db_1.default.query(docQuery, docParams);
        // Trả về dữ liệu đã kèm theo thông tin cấu hình
        res.status(200).json({
            folders: foldersResult.rows,
            documents: docsResult.rows
        });
    }
    catch (error) {
        console.error("Lỗi tải Drive:", error);
        res.status(500).json({ message: "Lỗi tải dữ liệu Drive" });
    }
};
exports.getDriveContents = getDriveContents;
//# sourceMappingURL=folderController.js.map