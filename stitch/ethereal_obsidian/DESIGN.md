# Design System Specification: The Luminescent Layer

## 1. Overview & Creative North Star

### Creative North Star: "The Ethereal Intelligence"
This design system moves beyond the rigid, "boxy" structures of traditional SaaS. It envisions the UI not as a flat screen, but as a deep, multi-dimensional space where data floats within a pressurized, atmospheric environment. By prioritizing **Depth over Division**, we create a high-end editorial experience that feels premium, cinematic, and infinitely scalable.

**Breaking the Template:**
*   **Intentional Asymmetry:** Avoid perfectly centered, static grids. Use off-balance headline placements and varying card widths (using the Spacing Scale) to create a sense of motion.
*   **Overlapping Elements:** Objects should breathe. Use negative margins and high z-index "glass" panels to partially obscure background gradients, suggesting a world that exists beyond the frame.
*   **Atmospheric Perspective:** Elements further "back" in the hierarchy are darker and more blurred; interactive elements "rise" toward the user, gaining luminosity and clarity.

---

## 2. Colors & Surface Architecture

The palette is anchored in deep cosmic tones (`background: #060e20`) and energized by high-chroma accents.

### The "No-Line" Rule
**Borders are a failure of contrast.** This design system prohibits the use of 1px solid lines for sectioning. Structural boundaries must be defined solely through:
1.  **Tonal Shifts:** Placing a `surface_container_low` section against a `surface` background.
2.  **Luminance Stepping:** Nesting a `surface_container_highest` element inside a `surface_container`.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of frosted glass.
*   **Base Layer:** `surface` (#060e20) – The infinite void.
*   **Section Layer:** `surface_container_low` – Large layout blocks.
*   **Component Layer:** `surface_container` – Standard cards.
*   **Active/Elevated Layer:** `surface_container_highest` – Modals or hovered states.

### The "Glass & Gradient" Rule
To achieve the signature "TrendPrompt" look, apply `backdrop-filter: blur(20px)` to all floating panels. Use `surface_variant` at 40-60% opacity as the fill. 
*   **Signature Textures:** Main CTAs should never be flat. Use a linear gradient: `primary` (#9fa7ff) to `secondary` (#c180ff) at a 135-degree angle to provide "visual soul."

---

## 3. Typography: Editorial Authority

We use a dual-font approach to balance technical precision with high-fashion editorial flair.

*   **Display & Headlines (Manrope):** Large, airy, and bold. Use `display-lg` (3.5rem) for hero moments. Tighten letter-spacing (-0.04em) for a "compact luxury" feel.
*   **Interface & Body (Inter):** Highly legible and functional. Use `body-md` (0.875rem) for general UI to keep the interface feeling "pro" and compact, similar to Raycast.
*   **Metadata (Label):** Use `label-sm` (0.6875rem) in `on_surface_variant` for timestamps, tags, and secondary data. This creates a "technical blueprint" aesthetic.

---

## 4. Elevation & Depth

### The Layering Principle
Hierarchy is achieved by "stacking" the surface tokens. An inner search bar should be `surface_container_lowest` (sunken) inside a `surface_container` card (raised). This creates natural, tactile depth without clutter.

### Ambient Shadows
Shadows must feel like light passing through glass, not black ink.
*   **Formula:** `box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(159, 167, 255, 0.05);`
*   The subtle tint of `primary` in the shadow mimics the "glow" of the AI engine.

### The "Ghost Border" Fallback
If a boundary is required for accessibility, use a **Ghost Border**:
*   `outline_variant` (#40485d) at **15% opacity**.
*   This provides a hint of a container without breaking the "glass" illusion.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `secondary`), `full` roundedness, and a subtle outer glow on hover using `surface_tint`.
*   **Secondary:** Glassmorphic fill (20% opacity `surface_variant`) with a Ghost Border.
*   **Interaction:** On hover, buttons should "lift" by 2px and increase backdrop-blur intensity.

### Floating Cards & Lists
*   **Forbid Dividers:** Use `3.5rem` (10) or `4rem` (12) spacing from the scale to separate list items. 
*   **Hover State:** Items should transition to `surface_bright` with a `2rem` (lg) corner radius.
*   **Glow Effects:** Interactive cards should have a radial gradient "spotlight" that follows the cursor, using a 5% opacity `tertiary` color.

### Input Fields
*   **Style:** `surface_container_lowest` background (darker than the card it sits on) to create an "etched" look.
*   **Focus:** Transition the Ghost Border from 15% opacity to 100% `primary` with a soft outer glow.

### Signature AI Components
*   **Prompt Pulse:** A shimmering border-image animation using the `primary` to `tertiary` gradient for active AI processing states.
*   **Glass Chips:** Metadata tags with `backdrop-filter: blur(10px)` and `0.5rem` (sm) rounding for a "beaded" look.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use `24px/2xl` (md/lg) rounding for all primary containers to maintain a soft, modern friendliness.
*   **Do** allow background gradients to bleed through components. If the background is `Electric Purple`, the glass panel over it should feel subtly purple.
*   **Do** prioritize whitespace. If a layout feels "crowded," double the spacing token rather than adding a border.

### Don't
*   **Don't** use pure white (#FFFFFF) for text. Use `on_surface` (#dee5ff) to keep the contrast high but the tone harmonious.
*   **Don't** use traditional "Drop Shadows" (dark, offset, tight). They break the glass aesthetic. Use Ambient Shadows only.
*   **Don't** use standard 1px dividers. They create "visual noise" and make the SaaS look like a 2015-era dashboard.