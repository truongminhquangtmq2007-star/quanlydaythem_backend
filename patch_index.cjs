const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

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

fs.writeFileSync('src/index.ts', code);
console.log("Patched index.ts");

