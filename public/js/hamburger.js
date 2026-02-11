/**
 * Hamburger Menu Controller
 * Handles mobile menu toggle with keyboard navigation and accessibility
 * WCAG AA compliant - keyboard navigation, ARIA attributes, focus management
 */

class HamburgerMenu {
  constructor() {
    this.btn = document.querySelector('.hamburger-btn');
    this.menu = document.querySelector('.nav-menu');
    this.menuLinks = Array.from(this.menu?.querySelectorAll('a') || []);

    if (!this.btn || !this.menu) {
      console.warn('Hamburger menu elements not found');
      return;
    }

    this.isOpen = false;
    this.init();
  }

  init() {
    // Bind button click
    this.btn.addEventListener('click', () => this.toggle());

    // Handle keyboard navigation
    this.btn.addEventListener('keydown', (e) => this.handleButtonKeydown(e));
    this.menu.addEventListener('keydown', (e) => this.handleMenuKeydown(e));

    // Close menu when clicking on a link
    this.menuLinks.forEach(link => {
      link.addEventListener('click', () => this.close());
    });

    // Close menu on Escape anywhere
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        this.btn.focus();
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen &&
        !e.target.closest('.nav-container') &&
        !e.target.closest('.nav-menu')) {
        this.close();
      }
    });

    // Handle window resize - close menu on desktop view
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && this.isOpen) {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.menu.classList.add('active');
    this.btn.setAttribute('aria-expanded', 'true');

    // Move focus to first menu link
    if (this.menuLinks.length > 0) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => this.menuLinks[0].focus(), 0);
    }
  }

  close() {
    this.isOpen = false;
    this.menu.classList.remove('active');
    this.btn.setAttribute('aria-expanded', 'false');
  }

  handleButtonKeydown(e) {
    // Open menu with Enter or Space
    if ((e.key === 'Enter' || e.key === ' ') && !this.isOpen) {
      e.preventDefault();
      this.open();
    }

    // Tab to next focusable element (menu will handle it)
    if (e.key === 'Tab' && this.isOpen) {
      const lastLink = this.menuLinks[this.menuLinks.length - 1];
      if (document.activeElement === lastLink) {
        // When tabbing past last menu item, close menu
        this.close();
      }
    }
  }

  handleMenuKeydown(e) {
    // Escape closes menu
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      this.btn.focus();
      return;
    }

    // Tab key navigation within menu
    if (e.key === 'Tab') {
      const currentIndex = this.menuLinks.indexOf(document.activeElement);

      // Tab on last item closes menu
      if (currentIndex === this.menuLinks.length - 1) {
        this.close();
        // Focus will move to next element naturally
      }
      // Shift+Tab on first item goes to button
      else if (e.shiftKey && currentIndex === 0) {
        e.preventDefault();
        this.close();
        this.btn.focus();
      }
    }

    // Arrow down moves to next menu item
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = this.menuLinks.indexOf(document.activeElement);
      // Loop to first item if at end
      const nextIndex = currentIndex === this.menuLinks.length - 1 ? 0 : currentIndex + 1;
      this.menuLinks[nextIndex].focus();
    }

    // Arrow up moves to previous menu item
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = this.menuLinks.indexOf(document.activeElement);
      // Loop to last item if at start
      const prevIndex = currentIndex === 0 ? this.menuLinks.length - 1 : currentIndex - 1;
      this.menuLinks[prevIndex].focus();
    }

    // Home goes to first menu item
    if (e.key === 'Home') {
      e.preventDefault();
      this.menuLinks[0].focus();
    }

    // End goes to last menu item
    if (e.key === 'End') {
      e.preventDefault();
      this.menuLinks[this.menuLinks.length - 1].focus();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new HamburgerMenu();
  });
} else {
  new HamburgerMenu();
}
