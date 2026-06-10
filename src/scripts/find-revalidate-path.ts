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

console.log('--- FIND revalidatePath ---');
walkDir(path.resolve(process.cwd(), 'src'), (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('revalidatePath')) {
    console.log(`File: ${filePath}`);
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('revalidatePath')) {
        console.log(`  L${index + 1}: ${line.trim()}`);
      }
    });
  }
});
console.log('--- END FIND revalidatePath ---');
