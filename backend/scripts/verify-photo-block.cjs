const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const T = path.resolve(__dirname, '..', 'templates', 'original_example.docx');
const buf = fs.readFileSync(T);
const zip = new PizZip(buf);
const xml = zip.file('word/document.xml').asText();
const count = (s) => xml.split(s).length - 1;

const imageTag = '{' + '%' + 'image}';
const tokens = ['{#photos}', '{/photos}', imageTag, '{caption}'];
const result = {};
for (const t of tokens) result[t] = count(t);
result.legacy = xml.match(/photo_\d+/g) || 'none';
result.size = buf.length;
// also capture the surrounding context of the image tag to confirm exact bytes
const idx = xml.indexOf(imageTag);
result.imageContext = idx >= 0 ? xml.slice(idx - 30, idx + 40) : 'NOT FOUND';
fs.writeFileSync(path.resolve(__dirname, 'verify-out.json'), JSON.stringify(result, null, 2));
