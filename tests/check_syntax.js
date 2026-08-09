const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter((file) => file.endsWith('.gs')).sort();
for (const file of files) {
  new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}
console.log(`Parsed ${files.length} Apps Script files successfully.`);
