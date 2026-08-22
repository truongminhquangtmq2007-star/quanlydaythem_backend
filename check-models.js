// check-models.js - Kiểm tra danh sách Gemini models khả dụng
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  console.log('🔍 Đang kiểm tra danh sách Gemini models khả dụng...\n');
  
  try {
    const pager = await ai.models.list();
    const models = [];
    for await (const model of pager) {
      models.push(model);
    }
    
    console.log(`📋 Tìm thấy ${models.length} models:\n`);
    
    // Lọc chỉ các model generateContent
    const genModels = models.filter(m => 
      m.supportedActions && m.supportedActions.includes('generateContent')
    );
    
    console.log('=== CÁC MODEL HỖ TRỢ generateContent ===');
    genModels.forEach(m => {
      console.log(`  ✅ ${m.name} (${m.displayName || ''})`);
    });
    
    console.log('\n=== TOÀN BỘ MODELS ===');
    models.forEach(m => {
      console.log(`  - ${m.name} | ${m.displayName || ''} | Actions: ${(m.supportedActions || []).join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Lỗi khi gọi API:', error.message);
    
    // Fallback: thử gọi từng model phổ biến xem cái nào hoạt động
    console.log('\n🔄 Fallback: Thử ping từng model phổ biến...\n');
    const candidates = [
      'gemini-1.5-pro',
      'gemini-1.5-flash', 
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-pro',
      'gemini-1.0-pro',
    ];
    
    for (const model of candidates) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: 'Trả lời đúng 1 từ: "OK"',
        });
        console.log(`  ✅ ${model} → Hoạt động! Response: ${response.text?.trim()}`);
      } catch (e) {
        console.log(`  ❌ ${model} → Lỗi: ${e.message?.substring(0, 80)}`);
      }
    }
  }
}

main();

