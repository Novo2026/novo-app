import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = join(process.cwd(), 'src');
const EXTENSIONS = new Set(['.tsx', '.ts', '.css', '.jsx', '.js']);

const REPLACEMENTS = [
  ['[#1E3A5F]', 'brand-navy'],
  ['[#1e3a5f]', 'brand-navy'],
  ['[#152C47]', 'brand-navy-dark'],
  ['[#152c47]', 'brand-navy-dark'],
  ['[#2D5A8E]', 'brand-navy-light'],
  ['[#2d5a8e]', 'brand-navy-light'],
  ['[#FF6B35]', 'brand-orange'],
  ['[#ff6b35]', 'brand-orange'],
  ['[#E55A25]', 'brand-orange-dark'],
  ['[#e55a25]', 'brand-orange-dark'],
  ['[#FDF6EE]', 'brand-cream'],
  ['[#fdf6ee]', 'brand-cream'],
  ['[#e8d8c4]', 'brand-cream-border'],
  ['[#E8D8C4]', 'brand-cream-border'],
  ['[#2D9CDB]', 'brand-blue'],
  ['[#2d9cdb]', 'brand-blue'],
  ['[#27AE60]', 'brand-green'],
  ['[#27ae60]', 'brand-green'],
  ['[#EB5757]', 'brand-red'],
  ['[#eb5757]', 'brand-red'],
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (EXTENSIONS.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

let totalChanges = 0;
for (const file of walk(SRC_DIR)) {
  let content = readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    totalChanges++;
    console.log('Updated:', file);
  }
}

console.log(`Done. ${totalChanges} file(s) updated.`);
