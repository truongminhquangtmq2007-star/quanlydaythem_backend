const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

// 1. Add calendarRoutes
if (!code.includes("import calendarRoutes")) {
  code = code.replace(
    "import authRoutes from './routes/authRoutes';",
    "import authRoutes from './routes/authRoutes';\nimport calendarRoutes from './routes/calendarRoutes';"
  );
}

if (!code.includes("app.use('/api/calendar'")) {
  code = code.replace(
    "app.use('/api/auth', authRoutes);",
    "app.use('/api/auth', authRoutes);\napp.use('/api/calendar', calendarRoutes);"
  );
}

// 2. Fix CORS
code = code.replace(
  /app\.use\(cors\(\{\s*origin: '.*',\s*credentials: true\s*\}\)\);/g,
  `app.use(cors({\n  origin: 'https://quanlydaythem-frontend-dun.vercel.app',\n  credentials: true\n}));`
);
code = code.replace(
  /app\.use\(cors\(\{\s*origin: '\*',\s*credentials: true\s*\}\)\);/g,
  `app.use(cors({\n  origin: 'https://quanlydaythem-frontend-dun.vercel.app',\n  credentials: true\n}));`
);

fs.writeFileSync('src/index.ts', code);
console.log('index.ts patched correctly');

