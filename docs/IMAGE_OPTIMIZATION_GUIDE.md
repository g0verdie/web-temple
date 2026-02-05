# Image & Media Optimization Guide

## Overview
This guide documents the responsive image and media implementation for Temple B'nai Israel website (Story 1.5, Task 6).

## Responsive Image Strategy

### Breakpoint Strategy
Images should be optimized for these breakpoints:
- **320px** - Small mobile (iPhone SE)
- **375px** - Standard mobile
- **768px** - Tablet
- **1024px** - Desktop
- **1200px+** - Large desktop

### Image Format Recommendations
1. **WebP** - Primary format (smaller file size, excellent browser support)
2. **JPEG** - Fallback for older browsers
3. **PNG** - For logos, icons with transparency
4. **SVG** - For icons, logos (scalable, no quality loss)

### File Size Guidelines
- Mobile (320-767px): ≤150KB per image
- Tablet (768-1023px): ≤300KB per image
- Desktop (1024px+): ≤500KB per image

## Implementation Patterns

### 1. Basic Responsive Image
```html
<img 
  src="/images/photo-800w.jpg" 
  alt="Descriptive alt text for accessibility"
  loading="lazy"
  width="800" 
  height="600"
  class="img-responsive">
```

### 2. Responsive Image with srcset (Resolution Switching)
```html
<img 
  src="/images/photo-800w.jpg"
  srcset="/images/photo-400w.jpg 400w,
          /images/photo-800w.jpg 800w,
          /images/photo-1200w.jpg 1200w"
  sizes="(max-width: 768px) 100vw,
         (max-width: 1024px) 50vw,
         800px"
  alt="Descriptive alt text"
  loading="lazy"
  width="800"
  height="600">
```

**Explanation:**
- `srcset`: Lists available image sizes
- `sizes`: Tells browser which image to use at different viewport widths
- `loading="lazy"`: Defers loading until image is near viewport
- `width/height`: Prevents layout shift (Core Web Vitals)

### 3. Art Direction with Picture Element
Use when image composition should change at different breakpoints:
```html
<picture>
  <source 
    media="(max-width: 767px)" 
    srcset="/images/hero-mobile-400w.webp 400w,
            /images/hero-mobile-800w.webp 800w"
    type="image/webp"
    sizes="100vw">
  <source 
    media="(min-width: 768px)" 
    srcset="/images/hero-desktop-1200w.webp 1200w,
            /images/hero-desktop-1920w.webp 1920w"
    type="image/webp"
    sizes="(max-width: 1200px) 100vw, 1200px">
  <img 
    src="/images/hero-desktop-1200w.jpg" 
    alt="Descriptive alt text"
    loading="lazy"
    width="1200"
    height="600">
</picture>
```

### 4. Background Images (CSS)
For decorative images that don't need alt text:
```css
.hero-bg {
  background-image: url('/images/bg-mobile-800w.jpg');
  background-size: cover;
  background-position: center;
}

@media (min-width: 768px) {
  .hero-bg {
    background-image: url('/images/bg-tablet-1200w.jpg');
  }
}

@media (min-width: 1024px) {
  .hero-bg {
    background-image: url('/images/bg-desktop-1920w.jpg');
  }
}
```

### 5. Embedded Content (YouTube, Google Maps)

#### YouTube Embed (Responsive)
```html
<div class="embed-responsive">
  <iframe 
    src="https://www.youtube.com/embed/VIDEO_ID"
    title="Video description"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    loading="lazy">
  </iframe>
</div>
```

#### Google Maps Embed (Already Implemented)
```html
<div class="map-container">
  <iframe
    src="https://www.google.com/maps/embed?pb=..."
    title="Temple B'nai Israel Location Map"
    allowfullscreen
    loading="lazy"
    aria-label="Google Maps showing Temple location">
  </iframe>
</div>
```

## CSS Classes Available

### Image Containers
- `.img-responsive` - Basic responsive image (max-width: 100%, height: auto)
- `.img-container` - Aspect ratio container for images
  - `.img-container--16x9` - 16:9 aspect ratio
  - `.img-container--4x3` - 4:3 aspect ratio
  - `.img-container--1x1` - 1:1 square aspect ratio

### Embed Containers
- `.embed-responsive` - 16:9 responsive embed (YouTube, Vimeo)
- `.embed-responsive--4x3` - 4:3 aspect ratio
- `.embed-responsive--1x1` - 1:1 square aspect ratio

### Figure with Caption
```html
<figure class="figure">
  <img src="/images/photo.jpg" alt="Description" loading="lazy">
  <figcaption class="figure-caption">Photo caption text</figcaption>
</figure>
```

## Accessibility Requirements (WCAG AA - FR69)

### Alt Text Guidelines
1. **Descriptive Images**: Describe the image content
   ```html
   <img src="rabbi.jpg" alt="Rabbi Cohen leading Friday night service">
   ```

2. **Functional Images**: Describe the function
   ```html
   <img src="download-icon.svg" alt="Download calendar">
   ```

3. **Decorative Images**: Use empty alt
   ```html
   <img src="pattern.svg" alt="" role="presentation">
   ```

4. **Complex Images**: Use longdesc or aria-describedby
   ```html
   <img src="chart.png" alt="Membership growth chart" aria-describedby="chart-desc">
   <p id="chart-desc">Detailed description of chart data...</p>
   ```

### Embedded Content Accessibility
- Always include `title` attribute on iframes
- Add `aria-label` for screen reader context
- Ensure embedded content is keyboard accessible
- Provide alternative content for screen readers if needed

## Performance Optimization

### Lazy Loading
Apply to all images below the fold:
```html
<img src="image.jpg" alt="Description" loading="lazy">
```

**Exceptions (DO NOT lazy load):**
- Hero images / above-the-fold images
- Logo in header
- Critical UI images

### Image Compression Tools
- **Online**: TinyPNG, Squoosh, Compressor.io
- **CLI**: ImageMagick, sharp (Node.js)
- **Build tools**: imagemin (Webpack/Gulp)

### Target Metrics
- Lighthouse Performance Score: **>90**
- Largest Contentful Paint (LCP): **<2.5s**
- Cumulative Layout Shift (CLS): **<0.1**

## Current Implementation Status

### ✅ Completed (Task 6)
- [x] Responsive image CSS foundation in main.css
- [x] Aspect ratio containers for consistent sizing
- [x] Embed-responsive wrappers for iframes/videos
- [x] Google Maps iframe optimized with lazy loading
- [x] Picture element support styles
- [x] About page prose image styles enhanced
- [x] Contact page map container made fully responsive
- [x] Image lazy loading placeholder styles
- [x] Accessibility attributes on map iframe (title, aria-label)

### ⚠️ Pending (Future Implementation)
When images are added to the site, apply these patterns:
- [ ] Implement srcset for hero images (when added)
- [ ] Create multiple resolutions of uploaded images (320w, 800w, 1200w)
- [ ] Convert images to WebP format with JPEG fallbacks
- [ ] Add alt text to all images in CMS content
- [ ] Test image loading on slow 3G network (Lighthouse)
- [ ] Implement lazy loading for event images (when added)

## Testing Checklist

### Visual Testing
- [ ] Images scale without distortion on all breakpoints (375px, 768px, 1024px, 1200px)
- [ ] No horizontal scroll caused by images at any breakpoint
- [ ] Images have proper aspect ratios (no squishing/stretching)
- [ ] Embedded content (maps) scales properly on mobile
- [ ] Images appear correctly on portrait and landscape orientations

### Performance Testing
- [ ] Run Lighthouse audit on mobile (target >90 performance score)
- [ ] Test on slow 3G network (Chrome DevTools Network throttling)
- [ ] Verify lazy loading works (images load as user scrolls)
- [ ] Check Core Web Vitals: LCP <2.5s, CLS <0.1

### Accessibility Testing
- [ ] All images have alt text (run axe DevTools)
- [ ] Embedded iframes have title attributes
- [ ] Decorative images have empty alt or role="presentation"
- [ ] Images work with screen readers (NVDA/VoiceOver)

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] iOS Safari (iPhone/iPad)
- [ ] Chrome Mobile (Android)

## File Locations

### CSS Files
- `public/css/main.css` - Global responsive image styles (lines 508-625)
- `public/css/about.css` - Prose content image styles (lines 102-130)
- `public/css/contact.css` - Map container responsive styles (lines 105-125)

### Views with Media
- `src/views/contact.ejs` - Google Maps embed (line 22-28)
- `src/views/about.ejs` - CMS prose content may contain images
- `src/views/responsive-test.ejs` - Test SVG image (line 100)

### Documentation
- `docs/IMAGE_OPTIMIZATION_GUIDE.md` - This file
- `_bmad-output/implementation-artifacts/1-5-mobile-responsive-design-foundation.md` - Story 1.5 implementation record

## Resources

### Tools
- **Lighthouse**: Chrome DevTools > Lighthouse tab
- **Squoosh**: https://squoosh.app (image compression)
- **TinyPNG**: https://tinypng.com (PNG/JPEG compression)
- **ImageMagick**: CLI tool for batch image processing
- **axe DevTools**: Browser extension for accessibility testing

### Documentation
- [MDN: Responsive Images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
- [Web.dev: Optimize Images](https://web.dev/fast/#optimize-your-images)
- [WCAG 2.1: Images of Text](https://www.w3.org/WAI/WCAG21/Understanding/images-of-text)
- [CSS-Tricks: Aspect Ratio Boxes](https://css-tricks.com/aspect-ratio-boxes/)

---

**Last Updated:** February 4, 2026  
**Related Story:** 1.5 - Mobile Responsive Design Foundation  
**Related Tasks:** Task 6 (Image & Media Responsive Optimization)
