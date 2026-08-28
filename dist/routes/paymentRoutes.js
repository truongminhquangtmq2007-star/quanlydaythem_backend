"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const router = express_1.default.Router();
// Định nghĩa các đường dẫn kết nối với Controller
router.get('/', paymentController_1.getBills);
router.post('/create', paymentController_1.createBill);
router.put('/:id/pay', paymentController_1.markBillAsPaid);
router.post('/add-exam-scores', paymentController_1.addExamScores);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map