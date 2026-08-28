"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calendarController_1 = require("../controllers/calendarController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const verifyTokenFromQuery = (req, res, next) => {
    const token = req.query.token;
    if (!token) {
        res.status(401).json({ message: 'Không tìm thấy token trên URL' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(403).json({ message: 'Token không hợp lệ' });
        return;
    }
};
router.get('/auth', verifyTokenFromQuery, calendarController_1.authGoogleCalendar);
router.get('/callback', calendarController_1.oauthCallback);
router.post('/sync-event', authMiddleware_1.verifyToken, calendarController_1.syncEvent);
exports.default = router;
//# sourceMappingURL=calendarRoutes.js.map