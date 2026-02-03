import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the current state
const itemsPath = path.join(__dirname, 'src/data/items.json');
const progressPath = path.join(__dirname, 'scrape-progress.json');

const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));

console.log(`Total items: ${itemsData.items.length}`);
console.log(`Completed: ${progressData.completed.length}`);
console.log(`Errors: ${progressData.errors.length}`);
console.log(`\nItems with errors to retry:`);

progressData.errors.forEach((error, idx) => {
  console.log(`${idx + 1}. [${error.index}] ${error.name} - ${error.error}`);
});

// Export the error indices for the scraper
const errorIndices = progressData.errors.map(e => e.index);
fs.writeFileSync('error-indices.json', JSON.stringify(errorIndices, null, 2));
console.log(`\nWrote ${errorIndices.length} error indices to error-indices.json`);
