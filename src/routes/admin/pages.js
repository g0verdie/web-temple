/**
 * routes/admin/pages.js
 * Admin interface for managing static pages (About, Contact, etc.)
 */

const express = require('express');
const pageController = require('../../controllers/pageController');

const router = express.Router();

/**
 * Middleware: Check if user is authenticated and has admin/rabbi role
 * In MVP, this is a placeholder. Will be implemented with proper auth in Story 2 (Authentication)
 */
const requireAdmin = (req, res, next) => {
  // TODO: Implement proper authentication check
  // For MVP, we'll allow admin access. In production, verify:
  // - User is logged in (req.user exists)
  // - User has 'admin' or 'rabbi' role
  req.user = { id: 'admin-001', role: 'admin', name: 'Ilya' }; // Mock for development
  next();
};

/**
 * GET /admin/pages/:slug
 * Edit view for a specific page
 */
router.get('/:slug', requireAdmin, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page = await pageController.getPageForAdmin(slug);

    if (!page) {
      return res.status(404).render('404', {
        title: '404 - Page Not Found',
      });
    }

    const versions = await pageController.getVersionHistory(slug);

    res.render('layout', {
      title: `Edit ${page.title}`,
      bodyView: 'admin/pages/edit',
      viewData: { page, versions, slug },
    });
  } catch (error) {
    console.error('Error loading admin edit page:', error);
    next(error);
  }
});

/**
 * POST /admin/pages/:slug
 * Update page content
 */
router.post('/:slug', requireAdmin, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required',
      });
    }

    const updatedPage = await pageController.updatePage(slug, { title, content }, req.user.id);

    res.json({
      success: true,
      page: updatedPage,
      message: 'Page updated successfully',
    });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({
      error: 'Failed to update page',
      message: error.message,
    });
  }
});

/**
 * POST /admin/pages/:slug/publish
 * Publish a page
 */
router.post('/:slug/publish', requireAdmin, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { published } = req.body;

    if (typeof published !== 'boolean') {
      return res.status(400).json({
        error: 'Published must be a boolean value',
      });
    }

    const updatedPage = await pageController.publishPage(slug, published, req.user.id);

    res.json({
      success: true,
      page: updatedPage,
      message: `Page ${published ? 'published' : 'unpublished'} successfully`,
    });
  } catch (error) {
    console.error('Error publishing page:', error);
    res.status(500).json({
      error: 'Failed to publish page',
      message: error.message,
    });
  }
});

/**
 * GET /admin/pages/:slug/versions
 * Get version history
 */
router.get('/:slug/versions', requireAdmin, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const versions = await pageController.getVersionHistory(slug);

    res.json({
      success: true,
      versions,
    });
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({
      error: 'Failed to fetch version history',
      message: error.message,
    });
  }
});

/**
 * POST /admin/pages/:slug/restore/:versionNumber
 * Restore page to a specific version
 */
router.post('/:slug/restore/:versionNumber', requireAdmin, async (req, res, next) => {
  try {
    const { slug, versionNumber } = req.params;

    const restoredPage = await pageController.restoreVersion(
      slug,
      parseInt(versionNumber, 10),
      req.user.id,
    );

    res.json({
      success: true,
      page: restoredPage,
      message: `Page restored to version ${versionNumber}`,
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({
      error: 'Failed to restore version',
      message: error.message,
    });
  }
});

module.exports = router;
