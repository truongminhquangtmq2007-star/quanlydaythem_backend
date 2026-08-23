const fs = require('fs');

let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const fallbackCode = `
export async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      if (response.text) {
         return response.text;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(\`[AI Warning] Mô hình \${modelName} lỗi, đang thử mô hình tiếp theo...\`, error.message);
    }
  }
  
  throw lastError;
}
`;

code += '\n' + fallbackCode;
fs.writeFileSync('src/services/geminiService.ts', code);
console.log('Patched geminiService.ts');

