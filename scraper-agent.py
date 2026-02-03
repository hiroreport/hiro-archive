#!/usr/bin/env python3
"""
Hiro Archive Scraper - Agent Direct Version
Processes items and writes individual commands for the agent to execute
"""

import json
import sys
from pathlib import Path

ITEMS_PATH = Path(__file__).parent / 'src/data/items.json'
PROGRESS_PATH = Path(__file__).parent / 'scrape-progress.json'

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

def get_next_batch(batch_size=10):
    """Get the next batch of items to scrape"""
    data = load_json(ITEMS_PATH)
    progress = load_json(PROGRESS_PATH)
    
    items = data['items']
    completed = set(progress.get('completed', []))
    
    next_items = []
    for i, item in enumerate(items):
        if i not in completed:
            # Also skip if already has imageUrl (from a previous run)
            if not item.get('imageUrl') or item.get('scrapeStatus') != 'completed':
                next_items.append((i, item))
                if len(next_items) >= batch_size:
                    break
    
    return next_items

def main():
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    next_batch = get_next_batch(batch_size)
    
    if not next_batch:
        print("No items left to scrape!")
        return
    
    print(f"Next {len(next_batch)} items to scrape:\n")
    for i, item in next_batch:
        print(f"[{i}] {item['name']}")
        print(f"    URL: {item['url']}")
        print(f"    Category: {item['category']}")
        print()

if __name__ == '__main__':
    main()
