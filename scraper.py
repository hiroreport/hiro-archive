#!/usr/bin/env python3
"""
Hiro Archive Scraper
Enriches items.json with product images and prices
"""

import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse, urljoin
from datetime import datetime

ITEMS_PATH = Path(__file__).parent / 'src/data/items.json'
PROGRESS_PATH = Path(__file__).parent / 'scrape-progress.json'
BATCH_SIZE = 50
RATE_LIMIT_SEC = 2

def load_json(path):
    """Load JSON file"""
    with open(path, 'r') as f:
        return json.load(f)

def save_json(path, data):
    """Save JSON file"""
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def load_progress():
    """Load scraping progress"""
    try:
        return load_json(PROGRESS_PATH)
    except FileNotFoundError:
        return {
            'lastIndex': -1,
            'errors': [],
            'completed': [],
            'startedAt': datetime.now().isoformat()
        }

def extract_price(text):
    """Extract price from text"""
    if not text:
        return None
    
    patterns = [
        r'\$[\d,]+\.?\d*',  # $99.99
        r'USD?\s*[\d,]+\.?\d*',  # USD 99.99
        r'£[\d,]+\.?\d*',  # £99.99
        r'€[\d,]+\.?\d*',  # €99.99
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            return matches[0].strip()
    
    return None

def extract_image_url(text, base_url):
    """Extract primary image URL from page content"""
    if not text:
        return None
    
    # Prioritize og:image and twitter:image meta tags
    patterns = [
        (r'property=["\']og:image["\']\\s+content=["\']([^"\']+)["\']', 100),
        (r'content=["\']([^"\']+)["\']\\s+property=["\']og:image["\']', 100),
        (r'name=["\']twitter:image["\']\\s+content=["\']([^"\']+)["\']', 90),
        (r'"image":\\s*"([^"]+)"', 80),  # JSON-LD
        (r'!\[.*?\]\(([^)]+)\)', 50),  # Markdown
        (r'<img[^>]+src=["\']([^"\']+)["\']', 40),  # HTML img
    ]
    
    best_url = None
    best_score = 0
    
    for pattern, score in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            url = match.strip()
            
            # Skip unwanted images
            skip_patterns = ['icon', 'logo', 'avatar', 'placeholder', 'sprite']
            if any(s in url.lower() for s in skip_patterns):
                continue
            if url.startswith('data:') or url.endswith('.svg'):
                continue
            
            # Make absolute URL
            if url.startswith('//'):
                url = 'https:' + url
            elif url.startswith('/'):
                parsed = urlparse(base_url)
                url = f"{parsed.scheme}://{parsed.netloc}{url}"
            
            # Higher score wins
            if score > best_score:
                best_url = url
                best_score = score
    
    return best_url

def fetch_url(url):
    """Fetch URL content using clawdbot CLI"""
    try:
        result = subprocess.run(
            ['clawdbot', 'web-fetch', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return result.stdout
        else:
            raise Exception(f"web-fetch failed: {result.stderr}")
    except subprocess.TimeoutExpired:
        raise Exception("Timeout")
    except Exception as e:
        raise Exception(f"Fetch error: {str(e)}")

def scrape_item(item, index):
    """Scrape a single item"""
    print(f"\n[{index}] {item['name']}")
    print(f"    URL: {item['url']}")
    
    try:
        # Fetch page content
        content = fetch_url(item['url'])
        
        # Extract data
        image_url = extract_image_url(content, item['url'])
        current_price = extract_price(content)
        
        print(f"    Image: {image_url or 'NOT FOUND'}")
        print(f"    Price: {current_price or 'NOT FOUND'}")
        
        return {
            'success': True,
            'imageUrl': image_url,
            'currentPrice': current_price,
            'scrapeStatus': 'completed',
            'scrapedAt': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"    ✗ Error: {str(e)}")
        return {
            'success': False,
            'scrapeStatus': 'error',
            'scrapeError': str(e),
            'scrapedAt': datetime.now().isoformat()
        }

def git_commit_push(message):
    """Commit and push changes"""
    try:
        subprocess.run(['git', 'add', '.'], cwd=ITEMS_PATH.parent, check=True)
        subprocess.run(['git', 'commit', '-m', message], cwd=ITEMS_PATH.parent, check=True)
        subprocess.run(['git', 'push'], cwd=ITEMS_PATH.parent, check=True)
        print(f"\n✓ Committed and pushed: {message}\n")
    except Exception as e:
        print(f"\n⚠ Git error: {e}\n")

def main():
    """Main scraping loop"""
    print("=== Hiro Archive Scraper ===\n")
    
    # Load data
    data = load_json(ITEMS_PATH)
    progress = load_progress()
    
    items = data['items']
    total = len(items)
    start_index = progress['lastIndex'] + 1
    
    print(f"Total items: {total}")
    print(f"Starting from: {start_index}")
    print(f"Previous errors: {len(progress['errors'])}\n")
    
    processed = 0
    success_count = 0
    error_count = 0
    
    for i in range(start_index, total):
        item = items[i]
        
        # Skip if already completed
        if item.get('scrapeStatus') == 'completed' and item.get('imageUrl'):
            print(f"[{i}] SKIP (already done): {item['name']}")
            continue
        
        # Scrape
        result = scrape_item(item, i)
        
        # Update item
        items[i].update(result)
        
        if result['success']:
            success_count += 1
            progress['completed'].append(i)
        else:
            error_count += 1
            progress['errors'].append({
                'index': i,
                'name': item['name'],
                'error': result.get('scrapeError', 'Unknown error')
            })
        
        processed += 1
        progress['lastIndex'] = i
        
        # Save progress
        save_json(PROGRESS_PATH, progress)
        save_json(ITEMS_PATH, data)
        
        # Batch commit
        if processed % BATCH_SIZE == 0:
            print(f"\n--- Checkpoint: {processed} items processed ---")
            git_commit_push(f"Scrape batch: {processed} items ({success_count} success, {error_count} errors)")
        
        # Rate limit
        time.sleep(RATE_LIMIT_SEC)
    
    # Final save and commit
    save_json(PROGRESS_PATH, progress)
    save_json(ITEMS_PATH, data)
    
    print(f"\n=== Scraping Complete ===")
    print(f"Processed: {processed}")
    print(f"Success: {success_count}")
    print(f"Errors: {error_count}")
    
    if processed > 0:
        git_commit_push(f"Scrape complete: {processed} total ({success_count} success, {error_count} errors)")

if __name__ == '__main__':
    main()
