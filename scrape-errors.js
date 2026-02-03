import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const itemsPath = path.join(__dirname, 'src/data/items.json');
const progressPath = path.join(__dirname, 'scrape-progress.json');

// Load data
const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));

// Get error indices
const errorIndices = progressData.errors.map(e => e.index);

console.log(`Found ${errorIndices.length} items to scrape`);

// Helper to extract YouTube video ID
function getYouTubeVideoId(url) {
  const patterns = [
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Process items
for (const index of errorIndices) {
  const item = itemsData.items[index];
  console.log(`\n[${index}] ${item.name}`);
  console.log(`URL: ${item.url}`);
  
  // Extract image based on URL type
  if (item.url.includes('youtube.com') || item.url.includes('youtu.be')) {
    const videoId = getYouTubeVideoId(item.url);
    if (videoId) {
      item.imageUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      console.log(`✓ YouTube thumbnail: ${item.imageUrl}`);
    }
  }
  
  // Mark as manually reviewed
  item.scrapeStatus = 'manual';
  item.scrapedAt = new Date().toISOString();
}

// Save items
fs.writeFileSync(itemsPath, JSON.stringify(itemsData, null, 2));
console.log(`\n✓ Updated items.json`);

// Export URLs for manual scraping
const urlsToCheck = errorIndices.map(i => ({
  index: i,
  name: itemsData.items[i].name,
  url: itemsData.items[i].url,
  type: itemsData.items[i].url.includes('youtube') ? 'youtube' : 
        itemsData.items[i].url.includes('kickstarter') ? 'kickstarter' :
        itemsData.items[i].url.includes('apps.apple.com') ? 'app_store' : 'other'
}));

fs.writeFileSync('urls-to-scrape.json', JSON.stringify(urlsToCheck, null, 2));
console.log(`✓ Wrote URLs to urls-to-scrape.json`);
