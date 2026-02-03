#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const ITEMS_PATH = './src/data/items.json';
const PROGRESS_PATH = './scrape-progress.json';
const BATCH_SIZE = 50;
const DELAY_MS = 1000; // 1 second between requests

// Load data
const itemsData = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf8'));
const progressData = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));

const items = itemsData.items;
const completed = new Set(progressData.completed || []);
const errors = progressData.errors || [];
const skipped = progressData.skipped || [];

// Helper to fetch URL
async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };
    
    protocol.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ html: data, status: res.statusCode }));
    }).on('error', reject);
  });
}

// Extract image URL from HTML
function extractImage(html, url) {
  // Try Open Graph image first
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch) return ogMatch[1];
  
  // Try Twitter card
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
  if (twitterMatch) return twitterMatch[1];
  
  // Try to find main product image (common patterns)
  const imgMatch = html.match(/<img[^>]*class=["'][^"']*(?:product|hero|main|featured)[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
                   html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*(?:product|hero|main|featured)[^"']*["']/i);
  if (imgMatch) {
    let imgUrl = imgMatch[1];
    if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
    else if (imgUrl.startsWith('/')) {
      const base = new URL(url);
      imgUrl = base.origin + imgUrl;
    }
    return imgUrl;
  }
  
  return null;
}

// Extract price from HTML
function extractPrice(html) {
  // Common price patterns
  const patterns = [
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    /(?:price|cost)["']?\s*[>:]\s*["']?\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>(?:[^$]*\$)?(\d+(?:,\d{3})*(?:\.\d{2})?)/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const price = match[1].replace(/,/g, '');
      return '$' + price;
    }
  }
  
  return null;
}

// Scrape a single item
async function scrapeItem(item, index) {
  console.log(`[${index}] Scraping: ${item.name}`);
  
  try {
    const { html, status } = await fetchUrl(item.url);
    
    if (status !== 200) {
      console.log(`  ⚠️  Status ${status}`);
      return { status: 'error', error: `HTTP ${status}` };
    }
    
    const imageUrl = extractImage(html, item.url);
    const currentPrice = extractPrice(html);
    
    console.log(`  📸 Image: ${imageUrl ? '✓' : '✗'}`);
    console.log(`  💰 Price: ${currentPrice || 'none'}`);
    
    return {
      status: 'success',
      imageUrl: imageUrl || null,
      currentPrice: currentPrice || null
    };
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

// Save progress
function saveProgress() {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify({
    completed: Array.from(completed).sort((a, b) => a - b),
    errors,
    skipped
  }, null, 2));
}

// Save items
function saveItems() {
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(itemsData, null, 2));
}

// Git commit
async function gitCommit(startIdx, endIdx) {
  const message = `Scraped items ${startIdx}-${endIdx} (${endIdx - startIdx + 1} items)`;
  console.log(`\n🔄 Committing: ${message}`);
  
  try {
    await execAsync('git add src/data/items.json scrape-progress.json');
    await execAsync(`git commit -m "${message}"`);
    await execAsync('git push');
    console.log('✅ Committed and pushed\n');
  } catch (error) {
    console.error('❌ Git error:', error.message);
  }
}

// Main scraping loop
async function main() {
  const startIndex = 450;
  const totalItems = items.length;
  let batchStart = startIndex;
  
  console.log(`Starting from index ${startIndex} (${totalItems - startIndex} items remaining)\n`);
  
  for (let i = startIndex; i < totalItems; i++) {
    if (completed.has(i)) continue;
    
    const item = items[i];
    const result = await scrapeItem(item, i);
    
    if (result.status === 'success') {
      item.imageUrl = result.imageUrl;
      item.currentPrice = result.currentPrice;
      item.scrapeStatus = 'scraped';
      item.scrapedAt = new Date().toISOString();
      completed.add(i);
    } else {
      errors.push({ index: i, name: item.name, error: result.error });
      item.scrapeStatus = 'error';
    }
    
    // Save after each item
    saveProgress();
    saveItems();
    
    // Commit every BATCH_SIZE items
    if ((i - startIndex + 1) % BATCH_SIZE === 0) {
      await gitCommit(batchStart, i);
      batchStart = i + 1;
    }
    
    // Delay between requests
    if (i < totalItems - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  // Final commit if there are remaining items
  if (batchStart < totalItems) {
    await gitCommit(batchStart, totalItems - 1);
  }
  
  console.log('\n✅ Scraping complete!');
  console.log(`   Completed: ${completed.size}/${totalItems}`);
  console.log(`   Errors: ${errors.length}`);
}

main().catch(console.error);
