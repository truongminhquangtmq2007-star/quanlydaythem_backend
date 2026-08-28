"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ai = new genai_1.GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
});
async function listMyModels() {
    console.log('Đang kiểm tra danh sách model khả dụng...');
    try {
        const response = await ai.models.list();
        for await (const model of response) {
            // In thẳng tên model ra, không cần kiểm tra điều kiện nữa
            console.log('✅ Model:', model.name);
        }
        console.log('Hoàn tất kiểm tra!');
    }
    catch (error) {
        console.error('Lỗi lấy danh sách:', error);
    }
}
listMyModels();
//# sourceMappingURL=check_models.js.map