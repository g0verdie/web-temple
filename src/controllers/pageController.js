/**
 * pageController.js
 * Manages static page CRUD operations, versioning, and publishing
 */

const { sanitizeHtml } = require('../utils/sanitizeHtml');

/**
 * Get a published page by slug
 * In production, this would query a database
 * For MVP, we'll use an in-memory storage with mock data
 */
const pages = {
  about: {
    id: 'about-001',
    slug: 'about',
    title: 'About the Temple',
    content: `
      <h2>Welcome to Temple B'nai Israel</h2>
      <p>Temple B'nai Israel is a vibrant and inclusive Jewish community dedicated to preserving Jewish tradition while embracing contemporary values.</p>
      <h3>Our Mission</h3>
      <p>To foster spiritual growth, community connection, and social justice through Jewish education, meaningful worship, and service to our community.</p>
      <h3>Our Community Values</h3>
      <ul>
        <li>Inclusivity and Welcome</li>
        <li>Spiritual Growth</li>
        <li>Community Service</li>
        <li>Social Justice</li>
        <li>Jewish Education</li>
      </ul>
    `,
    published: true,
    created_at: new Date('2026-02-04'),
    updated_at: new Date('2026-02-04'),
    versions: [
      {
        version_number: 1,
        title: 'About the Temple',
        content: '<h2>Welcome to Temple B\'nai Israel</h2><p>Temple B\'nai Israel is a vibrant community...</p>',
        created_at: new Date('2026-02-04'),
      },
    ],
  },
};

/**
 * Retrieve a published page by slug
 * @param {string} slug - Page slug (e.g., 'about', 'contact')
 * @returns {Promise<Object>} - Page data or null if not found
 */
async function getPublishedPage(slug) {
  try {
    if (!pages[slug]) {
      return null;
    }

    const page = pages[slug];
    
    // Only return published pages
    if (!page.published) {
      return null;
    }

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      published: page.published,
      updated_at: page.updated_at,
    };
  } catch (error) {
    console.error(`Error retrieving page ${slug}:`, error);
    throw error;
  }
}

/**
 * Retrieve a page (published or draft) by slug for admin editing
 * @param {string} slug - Page slug
 * @returns {Promise<Object>} - Full page data including versions
 */
async function getPageForAdmin(slug) {
  try {
    const page = pages[slug];
    
    if (!page) {
      return null;
    }

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      published: page.published,
      created_at: page.created_at,
      updated_at: page.updated_at,
      versions: page.versions || [],
    };
  } catch (error) {
    console.error(`Error retrieving page for admin ${slug}:`, error);
    throw error;
  }
}

/**
 * Update a page and create a version snapshot
 * @param {string} slug - Page slug
 * @param {Object} pageData - Updated page data (title, content)
 * @param {string} userId - ID of user making the edit
 * @returns {Promise<Object>} - Updated page data
 */
async function updatePage(slug, pageData, userId) {
  try {
    const page = pages[slug];
    
    if (!page) {
      throw new Error(`Page not found: ${slug}`);
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeHtml(pageData.content);

    // Create version snapshot of current state before updating
    const currentVersion = page.versions ? page.versions.length : 0;
    const newVersion = {
      version_number: currentVersion + 1,
      title: page.title,
      content: page.content,
      created_at: new Date(),
      created_by: userId,
    };

    if (!page.versions) {
      page.versions = [];
    }

    // Keep only last 10 versions
    if (page.versions.length >= 10) {
      page.versions.shift();
    }

    page.versions.push(newVersion);

    // Update page
    page.title = pageData.title || page.title;
    page.content = sanitizedContent;
    page.updated_at = new Date();
    page.updated_by = userId;

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      published: page.published,
      updated_at: page.updated_at,
    };
  } catch (error) {
    console.error(`Error updating page ${slug}:`, error);
    throw error;
  }
}

/**
 * Publish or unpublish a page
 * @param {string} slug - Page slug
 * @param {boolean} published - Publish status
 * @param {string} userId - ID of user publishing
 * @returns {Promise<Object>} - Updated page
 */
async function publishPage(slug, published, userId) {
  try {
    const page = pages[slug];
    
    if (!page) {
      throw new Error(`Page not found: ${slug}`);
    }

    page.published = published;
    page.updated_at = new Date();
    page.updated_by = userId;

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      published: page.published,
      updated_at: page.updated_at,
    };
  } catch (error) {
    console.error(`Error publishing page ${slug}:`, error);
    throw error;
  }
}

/**
 * Get version history for a page
 * @param {string} slug - Page slug
 * @returns {Promise<Array>} - Array of versions
 */
async function getVersionHistory(slug) {
  try {
    const page = pages[slug];
    
    if (!page || !page.versions) {
      return [];
    }

    return page.versions.map((v) => ({
      version_number: v.version_number,
      title: v.title,
      created_at: v.created_at,
      created_by: v.created_by,
    }));
  } catch (error) {
    console.error(`Error retrieving version history for ${slug}:`, error);
    throw error;
  }
}

/**
 * Restore a page to a specific version
 * @param {string} slug - Page slug
 * @param {number} versionNumber - Version to restore to
 * @param {string} userId - ID of user restoring
 * @returns {Promise<Object>} - Restored page
 */
async function restoreVersion(slug, versionNumber, userId) {
  try {
    const page = pages[slug];
    
    if (!page) {
      throw new Error(`Page not found: ${slug}`);
    }

    if (!page.versions) {
      throw new Error(`No version history found for ${slug}`);
    }

    const targetVersion = page.versions.find((v) => v.version_number === versionNumber);
    
    if (!targetVersion) {
      throw new Error(`Version ${versionNumber} not found for ${slug}`);
    }

    // Create version snapshot of current state before restoring
    const newVersion = {
      version_number: page.versions.length + 1,
      title: page.title,
      content: page.content,
      created_at: new Date(),
      created_by: userId,
    };

    page.versions.push(newVersion);

    // Restore from target version
    page.title = targetVersion.title;
    page.content = targetVersion.content;
    page.updated_at = new Date();
    page.updated_by = userId;

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      published: page.published,
      updated_at: page.updated_at,
      restored_from_version: versionNumber,
    };
  } catch (error) {
    console.error(`Error restoring version for ${slug}:`, error);
    throw error;
  }
}

module.exports = {
  getPublishedPage,
  getPageForAdmin,
  updatePage,
  publishPage,
  getVersionHistory,
  restoreVersion,
};
