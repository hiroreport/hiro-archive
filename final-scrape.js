import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const itemsPath = path.join(__dirname, 'src/data/items.json');
const progressPath = path.join(__dirname, 'scrape-progress.json');

const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));

// YouTube video ID extractor
function getYouTubeVideoId(url) {
  const patterns = [
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fetch page and extract OpenGraph/meta data
async function fetchMetadata(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 10000,
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchMetadata(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        // Extract og:image
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                            html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
        const imageUrl = ogImageMatch ? ogImageMatch[1] : null;
        
        // Extract price (common patterns)
        const pricePatterns = [
          /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
          /price["\s:]+\$?\s*(\d+(?:\.\d{2})?)/i,
        ];
        let price = null;
        for (const pattern of pricePatterns) {
          const match = html.match(pattern);
          if (match) {
            price = match[0].includes('$') ? match[0] : `$${match[1]}`;
            break;
          }
        }
        
        resolve({ imageUrl, price });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Process errors
async function processErrors() {
  const errorIndices = progressData.errors.map(e => e.index);
  const results = {
    success: [],
    failed: [],
    skipped: []
  };
  
  for (const index of errorIndices) {
    const item = itemsData.items[index];
    console.log(`\n[${index}] ${item.name}`);
    console.log(`URL: ${item.url}`);
    
    try {
      let imageUrl = null;
      let currentPrice = null;
      
      // Handle YouTube specially
      if (item.url.includes('youtube.com') || item.url.includes('youtu.be')) {
        const videoId = getYouTubeVideoId(item.url);
        if (videoId) {
          imageUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
          console.log(`✓ YouTube thumbnail`);
        }
      } else {
        // Try fetching metadata
        try {
          const metadata = await fetchMetadata(item.url);
          imageUrl = metadata.imageUrl;
          currentPrice = metadata.price;
          if (imageUrl) console.log(`✓ Found image`);
          if (currentPrice) console.log(`✓ Found price: ${currentPrice}`);
        } catch (err) {
          console.log(`✗ Fetch failed: ${err.message}`);
          results.failed.push({ index, name: item.name, error: err.message });
          continue;
        }
      }
      
      // Update item
      if (imageUrl) {
        item.imageUrl = imageUrl;
        item.scrapeStatus = 'scraped';
        item.scrapedAt = new Date().toISOString();
        if (currentPrice) item.currentPrice = currentPrice;
        results.success.push(index);
      } else {
        results.skipped.push({ index, name: item.name, reason: 'No image found' });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      results.failed.push({ index, name: item.name, error: err.message });
    }
  }
  
  return results;
}

// Run
console.log('Starting final scrape...\n');
const results = await processErrors();

console.log(`\n\n=== RESULTS ===`);
console.log(`Success: ${results.success.length}`);
console.log(`Failed: ${results.failed.length}`);
console.log(`Skipped: ${results.skipped.length}`);

// Save updated items
fs.writeFileSync(itemsPath, JSON.stringify(itemsData, null, 2));
console.log(`\n✓ Saved items.json`);

// Update progress
const nowCompleted = [...progressData.completed, ...results.success].sort((a, b) => a - b);
const remainingErrors = progressData.errors.filter(e => 
  !results.success.includes(e.index)
);

progressData.completed = nowCompleted;
progressData.errors = remainingErrors;

fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2));
console.log(`✓ Updated scrape-progress.json`);
console.log(`\nCompleted: ${nowCompleted.length}/${itemsData.items.length}`);
