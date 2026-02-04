# Design Notes & Inspiration

## Final Direction: "Cozy Editorial Archive"

Combining the **structure of Notion**, the **warmth of Wimp/Headspace**, but retaining the **authority of Editorial Typography** and the **energy of High-Voltage Orange**.

### 1. The Foundation: Warm & Clean
-   **Background:** Shift from cold `#fafafa` to a warmer "Paper" tone (`#f9f8f6` or similar). This provides the "cozy" feeling without losing cleanliness.
-   **Card Background:** Keep white `#ffffff` to maintain the "Editorial" crispness against the warm background.
-   **Text:** Soften slightly from pure black to a rich charcoal (`#2d2a2e`) to reduce eye strain on the warm background, but keep it high-contrast for readability.

### 2. The Brand Anchors (Retained)
-   **Typography:** Maintain `EB Garamond` (Headings) + `Inter` (Body).
-   **Accent:** Maintain `#ea580c` (Stark Orange) for links, buttons, and highlights. This provides the "pop" and keeps the brand identity strong.

### 3. The "Notion-esque" Structure
-   **Grid & Cards:**
    -   **Default state:** Minimalist. Remove heavy borders (`border: 1px solid var(--border)` -> `border: 1px solid transparent` or very subtle `rgba`).
    -   **Hover state:** "Float" effect. Lift up (`translateY`) with a softer, diffused shadow (Headspace style) rather than a sharp tech shadow.
-   **Filters:** Convert from outlined buttons to **Pill Tags**.
    -   *Active:* Solid Stark Orange (`#ea580c`) + White Text.
    -   *Inactive:* Subtle warm gray background, dark text. Hover triggers a subtle orange tint.

### 4. "Headspace" Delight & Motion
-   **Roundness:** maintain or slightly increase border-radius (Cards `16px`, Buttons `999px`).
-   **Micro-interactions:**
    -   **Emoji:** If no image exists, the placeholder emoji should be large, centered, and perhaps have a gentle "hover bounce" animation.
    -   **Images:** Smooth fade-in on load.
    -   **Cards:** The lift on hover should be springy (cubic-bezier) rather than linear.

## Technical Specifications (CSS Variables)

```css
:root {
  /* Warm Paper Base */
  --bg: #f9f8f6;
  --card-bg: #ffffff;
  
  /* Text - Softer Charcoal but High Contrast */
  --fg: #1c1917; /* Warm Black */
  --muted: #57534e; /* Warm Gray */
  
  /* Brand Anchors */
  --accent: #ea580c; /* KEEP: Stark Orange */
  --accent-hover: #c2410c;
  
  /* Soft Notion/Headspace Vibes */
  --border: rgba(0,0,0,0.04); /* Much lighter, just for definition */
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
  --shadow-hover: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.01);
}
```

## Implementation Checklist
1.  **Update CSS Variables:** Apply the warm palette and soft shadows.
2.  **Refactor Control Bar:** Style filter buttons as pills with the stark orange active state.
3.  **Refactor Cards:**
    -   Remove default borders.
    -   Apply new hover shadows and transitions.
    -   Optimize the "No Image" emoji state (center align, increase size).
4.  **Polish:** Check header spacing and footer to ensure they blend with the new warm background.
