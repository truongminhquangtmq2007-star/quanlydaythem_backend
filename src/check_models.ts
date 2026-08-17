import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
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
  } catch (error) {
    console.error('Lỗi lấy danh sách:', error);
  }
}

listMyModels();