#!/usr/bin/env python3
"""
Hiro Archive Scraper - Hybrid Approach
Uses both web_fetch (for prices) and browser (for images)
"""

import json
import re
import subprocess
import time
from pathlib import Path
from datetime import datetime

ITEMS_PATH = Path(__file__).parent / 'src/data/items.json'
PROGRESS_PATH = Path(__file__).parent / 'scrape-progress.json'
BATCH_SIZE = 50
RATE_LIMIT_SEC = 2

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def load_progress():
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
        r'\$[\d,]+\.?\d*',
        r'USD?\s*[\d,]+\.?\d*',
        r'£[\d,]+\.?\d*',
        r'€[\d,]+\.?\d*',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            return matches[0].strip()
    return None

def fetch_with_browser(url):
    """Use clawdbot browser to get og:image and price"""
    try:
        # Get page snapshot
        result = subprocess.run(
            ['clawdbot', 'browser', 'snapshot', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise Exception(f"Browser failed: {result.stderr}")
        
        output = result.stdout
        
        # Extract og:image from output
        og_image = None
        og_match = re.search(r'og:image["\s]+content="([^"]+)"', output, re.IGNORECASE)
        if og_match:
            og_image = og_match.group(1)
        
        # Try twitter:image as backup
        if not og_image:
            tw_match = re.search(r'twitter:image["\s]+content="([^"]+)"', output, re.IGNORECASE)
            if tw_match:
                og_image = tw_match.group(1)
        
        # Extract price
        price = extract_price(output)
        
        return og_image, price, None
        
    except Exception as e:
        return None, None, str(e)

def fetch_with_web_fetch(url):
    """Use web_fetch for simpler extraction"""
    try:
        result = subprocess.run(
            ['clawdbot', 'web-fetch', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise Exception(f"web-fetch failed: {result.stderr}")
        
        content = result.stdout
        price = extract_price(content)
        
        return price, None
        
    except Exception as e:
        return None, str(e)

def scrape_item(item, index):
    """Scrape a single item"""
    print(f"\n[{index}] {item['name']}")
    print(f"    URL: {item['url']}")
    
    image_url = None
    current_price = None
    error = None
    
    # Try web_fetch first (faster, less resource-intensive)
    print("    Trying web_fetch...")
    price, err = fetch_with_web_fetch(item['url'])
    if price:
        current_price = price
        print(f"    Price from web_fetch: {price}")
    
    # Use browser for image (slower but gets meta tags)
    print("    Trying browser for image...")
    img, browser_price, browser_err = fetch_with_browser(item['url'])
    
    if img:
        image_url = img
        print(f"    Image: {image_url}")
    else:
        print(f"    Image: NOT FOUND")
    
    if browser_price and not current_price:
        current_price = browser_price
        print(f"    Price from browser: {current_price}")
    
    if not current_price:
        print(f"    Price: NOT FOUND")
    
    # Collect errors
    if browser_err or err:
        error = browser_err or err
        print(f"    ⚠ Partial errors: {error}")
    
    # Determine success
    success = (image_url is not None or current_price is not None)
    
    return {
        'success': success,
        'imageUrl': image_url,
        'currentPrice': current_price,
        'scrapeStatus': 'completed' if success else 'error',
        'scrapeError': error if not success else None,
        'scrapedAt': datetime.now().isoformat()
    }

def git_commit_push(message):
    """Commit and push"""
    try:
        subprocess.run(['git', 'add', '.'], cwd=ITEMS_PATH.parent, check=True, capture_output=True)
        subprocess.run(['git', 'commit', '-m', message], cwd=ITEMS_PATH.parent, check=True, capture_output=True)
        subprocess.run(['git', 'push'], cwd=ITEMS_PATH.parent, check=True, capture_output=True)
        print(f"\n✓ Git: {message}\n")
    except Exception as e:
        print(f"\n⚠ Git error: {e}\n")

def main():
    print("=== Hiro Archive Hybrid Scraper ===\n")
    
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
        
        # Skip if already completed with image
        if item.get('scrapeStatus') == 'completed' and item.get('imageUrl'):
            print(f"[{i}] SKIP: {item['name']}")
            continue
        
        # Scrape
        result = scrape_item(item, i)
        
        # Update
        items[i].update(result)
        
        if result['success']:
            success_count += 1
            progress['completed'].append(i)
        else:
            error_count += 1
            progress['errors'].append({
                'index': i,
                'name': item['name'],
                'error': result.get('scrapeError', 'Unknown')
            })
        
        processed += 1
        progress['lastIndex'] = i
        
        # Save
        save_json(PROGRESS_PATH, progress)
        save_json(ITEMS_PATH, data)
        
        # Commit in batches
        if processed % BATCH_SIZE == 0:
            print(f"\n--- Checkpoint: {processed} processed ---")
            git_commit_push(f"Scrape: {processed} items ({success_count} OK, {error_count} errors)")
        
        # Rate limit
        time.sleep(RATE_LIMIT_SEC)
    
    # Final
    save_json(PROGRESS_PATH, progress)
    save_json(ITEMS_PATH, data)
    
    print(f"\n=== Complete ===")
    print(f"Processed: {processed}")
    print(f"Success: {success_count}")
    print(f"Errors: {error_count}")
    
    if processed > 0:
        git_commit_push(f"Scrape done: {processed} total ({success_count} OK, {error_count} fail)")

if __name__ == '__main__':
    main()
