import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const itemsPath = path.join(__dirname, 'src/data/items.json');
const progressPath = path.join(__dirname, 'scrape-progress.json');

const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));

// Fallback image patterns for known sites
const fallbacks = {
  'suno.ai': {
    imageUrl: 'https://cdn.suno.com/social-preview.png',
  },
  'traderjoes.com': {
    imageUrl: 'https://www.traderjoes.com/content/dam/trjo/images/products/ube-mochi-pancake-and-waffle-mix-068389.jpg',
  },
  'perplexity.ai': {
    imageUrl: 'https://www.perplexity.ai/images/og-image.png',
  },
  'huckberry.com': {
    imageUrl: 'https://huckberry.com/og-image.jpg',
  },
  'kickstarter.com': {
    imageUrl: null, // Kickstarter projects often have project-specific images
  },
  'evergoods.us': {
    imageUrl: 'https://evergoods.us/cdn/shop/products/CPL16_V2_BlackDiamond_01.jpg',
  },
  'insta360.com': {
    imageUrl: 'https://static.insta360.com/assets/cube/product/insta360-link/link-og.jpg',
  },
  'bambulab.com': {
    imageUrl: 'https://cdn.bambulab.com/image/a1.jpg',
  },
  'apps.apple.com': {
    // Apple App Store - will need specific app IDs
    imageUrl: null,
  },
  'phys.org': {
    imageUrl: null,
  },
  'wisdomexperience.org': {
    imageUrl: null,
  },
  'hodderscape.co.uk': {
    // Direct image URL - use as is
    useUrlAsImage: true,
  },
  'neal.fun': {
    imageUrl: 'https://neal.fun/internet-artifacts/social.png',
  },
  'music.apple.com': {
    imageUrl: null,
  },
  'poetryfoundation.org': {
    imageUrl: null,
  },
  'goretroid.com': {
    imageUrl: 'https://www.goretroid.com/cdn/shop/products/RP3PlusBlack16bit.png',
  },
  'tech.lgbt': {
    // Mastodon instance - no good default
    imageUrl: null,
  },
};

// Get remaining error items
const errorIndices = progressData.errors.map(e => e.index);
console.log(`Processing ${errorIndices.length} remaining items with fallbacks...\n`);

let updated = 0;
let skipped = 0;

for (const index of errorIndices) {
  const item = itemsData.items[index];
  console.log(`[${index}] ${item.name}`);
  
  try {
    const url = new URL(item.url);
    const domain = url.hostname.replace('www.', '');
    
    // Check for fallback
    let imageUrl = null;
    let updated_item = false;
    
    for (const [key, config] of Object.entries(fallbacks)) {
      if (domain.includes(key)) {
        if (config.useUrlAsImage) {
          imageUrl = item.url;
        } else if (config.imageUrl) {
          imageUrl = config.imageUrl;
        }
        break;
      }
    }
    
    if (imageUrl) {
      item.imageUrl = imageUrl;
      item.scrapeStatus = 'fallback';
      item.scrapedAt = new Date().toISOString();
      console.log(`  ✓ Applied fallback image`);
      updated++;
      updated_item = true;
    } else {
      item.scrapeStatus = 'unavailable';
      item.scrapedAt = new Date().toISOString();
      console.log(`  ⊘ Marked as unavailable (no fallback)`);
      skipped++;
      updated_item = true;
    }
    
    // Update progress if we made any change
    if (updated_item) {
      // Remove from errors, add to completed
      const errorIndex = progressData.errors.findIndex(e => e.index === index);
      if (errorIndex >= 0) {
        progressData.errors.splice(errorIndex, 1);
      }
      if (!progressData.completed.includes(index)) {
        progressData.completed.push(index);
      }
    }
    
  } catch (err) {
    console.log(`  ✗ Error processing: ${err.message}`);
  }
}

// Sort completed array
progressData.completed.sort((a, b) => a - b);

// Save files
fs.writeFileSync(itemsPath, JSON.stringify(itemsData, null, 2));
fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2));

console.log(`\n=== SUMMARY ===`);
console.log(`Updated with fallbacks: ${updated}`);
console.log(`Marked unavailable: ${skipped}`);
console.log(`Total completed: ${progressData.completed.length}/${itemsData.items.length}`);
console.log(`Remaining errors: ${progressData.errors.length}`);
