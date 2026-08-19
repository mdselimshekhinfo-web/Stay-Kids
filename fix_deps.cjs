const fs = require('fs');
let code = fs.readFileSync('src/AppChild.tsx', 'utf8');

// Replace }, [role]
code = code.replace(/\}, \[role\]\)/g, '}, [role, authenticated, ready])');

// Replace }, [role, ...]
code = code.replace(/\}, \[role, (.*?)\]\)/g, (match, p1) => {
  if (p1.includes('authenticated')) return match;
  return '}, [role, authenticated, ready, ' + p1 + '])';
});

fs.writeFileSync('src/AppChild.tsx', code);
