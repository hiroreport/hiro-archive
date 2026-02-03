#!/usr/bin/env node
/**
 * Hiro Archive Scraper - Extracts images and prices
 * Run with: node scraper.cjs [startIndex] [count]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ITEMS_PATH = path.join(__dirname, 'src/data/items.json');
const PROGRESS_PATH = path.join(__dirname, 'scrape-progress.json');

// Load data
function loadItems() {
  return JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf8'));
}

function saveItems(data) {
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(data, null, 2));
  console.log('  Saved items.json');
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  } catch {
    return { completed: [], errors: [], skipped: [] };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

// Extract og:image using curl
function getOgImage(url) {
  try {
    const cmd = `curl -sL --max-time 15 "${url}" 2>/dev/null | grep -oi 'og:image"[^>]*content="[^"]*"\\|property="og:image"[^>]*content="[^"]*"\\|name="twitter:image"[^>]*content="[^"]*"' | head -1 | sed 's/.*content="\\([^"]*\\)".*/\\1/'`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 20000 }).trim();
    
    // Fix relative URLs
    if (result && result.startsWith('/')) {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${result}`;
    }
    return result || null;
  } catch (e) {
    return null;
  }
}

// Extract price patterns from text
function extractPrice(text) {
  if (!text) return null;
  
  // Common price patterns
  const patterns = [
    /\$[\d,]+\.?\d{0,2}/g,           // $29.99, $1,299
    /USD\s*[\d,]+\.?\d{0,2}/gi,      // USD 29.99
    /£[\d,]+\.?\d{0,2}/g,            // £29.99
    /€[\d,]+\.?\d{0,2}/g,            // €29.99
    /¥[\d,]+/g,                       // ¥2999
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Return first price found (usually the main price)
      return matches[0];
    }
  }
  return null;
}

// Process a single item
function processItem(item, index) {
  console.log(`[${index}] ${item.name}`);
  console.log(`    URL: ${item.url}`);
  
  // Get image
  const imageUrl = getOgImage(item.url);
  if (imageUrl) {
    console.log(`    Image: ${imageUrl.substring(0, 60)}...`);
    item.imageUrl = imageUrl;
  } else {
    console.log(`    Image: NOT FOUND`);
    item.imageUrl = null;
  }
  
  // Try to extract price from existing data or fetch
  // For now, we'll mark for manual price extraction
  item.scrapeStatus = imageUrl ? 'scraped' : 'no-image';
  item.scrapedAt = new Date().toISOString();
  
  return item;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const startIndex = parseInt(args[0]) || 0;
  const count = parseInt(args[1]) || 10;
  
  console.log(`\n=== Hiro Archive Scraper ===`);
  console.log(`Processing items ${startIndex} to ${startIndex + count - 1}\n`);
  
  const data = loadItems();
  const progress = loadProgress();
  
  let processed = 0;
  for (let i = startIndex; i < Math.min(startIndex + count, data.items.length); i++) {
    const item = data.items[i];
    
    // Skip if already processed
    if (item.scrapeStatus && item.scrapeStatus !== 'pending') {
      console.log(`[${i}] ${item.name} - SKIP (already ${item.scrapeStatus})`);
      continue;
    }
    
    processItem(item, i);
    progress.completed.push(i);
    processed++;
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Save results
  saveItems(data);
  saveProgress(progress);
  
  console.log(`\nDone! Processed ${processed} items.`);
  console.log(`Total with images: ${data.items.filter(i => i.imageUrl).length}`);
  console.log(`Total scraped: ${data.items.filter(i => i.scrapeStatus).length}`);
}

main().catch(console.error);
