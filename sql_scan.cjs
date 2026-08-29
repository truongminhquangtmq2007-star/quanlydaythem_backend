const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    fs.readdirSync(dir).forEach(file => {
        file = path.join(dir, file);
        if (fs.statSync(file).isDirectory()) results = results.concat(walk(file));
        else if (file.endsWith('.ts')) results.push(file);
    });
    return results;
}
walk('src/controllers').forEach(f => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
        if (l.includes('pool.query') || l.includes('client.query')) {
            if (l.match(/query\s*\(\s*.*?\$\{.*?\}/)) {
                console.log(f + ':' + (i+1) + ' -> ' + l.trim());
            }
        }
    });
});

