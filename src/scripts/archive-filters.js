const search = document.getElementById('search');
const grid = document.getElementById('grid');
const stats = document.getElementById('stats');
const clearBtn = document.getElementById('clear-btn');
const emptyState = document.getElementById('empty-state');

if (
  !(search instanceof HTMLInputElement) ||
  !(grid instanceof HTMLElement) ||
  !(stats instanceof HTMLElement) ||
  !(clearBtn instanceof HTMLButtonElement) ||
  !(emptyState instanceof HTMLElement)
) {
  console.warn('Archive controls were not found in the DOM.');
} else {
  const cards = grid.querySelectorAll('.card');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const totalItems = cards.length;

  let activeCategory = 'all';
  let debounceTimer;

  const updateStats = (visibleCount) => {
    if (visibleCount === totalItems && activeCategory === 'all' && !search.value.trim()) {
      const issuesText = stats.getAttribute('data-issues-count') ?? '0';
      stats.textContent = `${totalItems} items from ${issuesText} newsletter issues`;
      return;
    }

    stats.textContent = `Showing ${visibleCount} of ${totalItems} items`;
  };

  const updateClearButton = () => {
    const hasFilters = activeCategory !== 'all' || search.value.trim() !== '';
    clearBtn.classList.toggle('visible', hasFilters);
  };

  const setActiveButton = (button) => {
    filterBtns.forEach(currentBtn => {
      currentBtn.classList.remove('active');
      currentBtn.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    activeCategory = button.getAttribute('data-category') ?? 'all';
  };

  const filterItems = () => {
    const query = search.value.toLowerCase();
    let visible = 0;

    cards.forEach(card => {
      const name = card.getAttribute('data-name') ?? '';
      const desc = card.getAttribute('data-desc') ?? '';
      const category = card.getAttribute('data-category');
      const isGiftGuide = card.getAttribute('data-gift-guide') === 'true';

      const matchesSearch = !query || name.includes(query) || desc.includes(query);
      const matchesCategory =
        activeCategory === 'all' ||
        (activeCategory === 'gift-guide' ? isGiftGuide : category === activeCategory);

      if (matchesSearch && matchesCategory) {
        card.classList.remove('hidden');
        visible += 1;
      } else {
        card.classList.add('hidden');
      }
    });

    if (visible === 0) {
      grid.style.display = 'none';
      emptyState.classList.add('visible');
    } else {
      grid.style.display = 'grid';
      emptyState.classList.remove('visible');
    }

    updateStats(visible);
    updateClearButton();
  };

  search.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(filterItems, 250);
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveButton(btn);
      filterItems();
    });
  });

  clearBtn.addEventListener('click', () => {
    search.value = '';
    const allButton = document.querySelector('[data-category="all"]');
    if (allButton instanceof HTMLElement) {
      setActiveButton(allButton);
    } else {
      activeCategory = 'all';
    }
    filterItems();
  });

  const issuesCountMatch = stats.textContent?.match(/from\s+(\d+)\s+newsletter issues/i);
  if (issuesCountMatch) {
    stats.setAttribute('data-issues-count', issuesCountMatch[1]);
  }
}
