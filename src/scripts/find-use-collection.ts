import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
      callback(filePath);
    }
  }
}

console.log('--- FIND useCollection ---');
walkDir(path.resolve(process.cwd(), 'src'), (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('useCollection')) {
    console.log(`File: ${filePath}`);
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('useCollection')) {
        console.log(`  L${index + 1}: ${line.trim()}`);
      }
    });
  }
});
console.log('--- END FIND useCollection ---');
