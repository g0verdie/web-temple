/**
 * pageController.js
 * Manages static page CRUD operations, versioning, and publishing
 * Uses PostgreSQL for data persistence
 */

const db = require('../config/db');
const { sanitizeHtml } = require('../utils/sanitizeHtml');

/**
 * Retrieve a published page by slug
 * @param {string} slug - Page slug (e.g., 'about', 'contact')
 * @returns {Promise<Object>} - Page data or null if not found
 */
async function getPublishedPage(slug) {
  try {
    const query = `
      SELECT id, slug, title, content, published, updated_at
      FROM static_pages
      WHERE slug = $1 AND published = true
    `;
    const result = await db.query(query, [slug]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
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
    const pageQuery = `
      SELECT id, slug, title, content, published, created_at, updated_at
      FROM static_pages
      WHERE slug = $1
    `;
    const pageResult = await db.query(pageQuery, [slug]);

    if (pageResult.rows.length === 0) {
      return null;
    }

    const page = pageResult.rows[0];

    const versionsQuery = `
      SELECT version_number, title, content, created_at, created_by
      FROM static_page_versions
      WHERE static_page_id = $1
      ORDER BY version_number DESC
    `;
    const versionsResult = await db.query(versionsQuery, [page.id]);

    page.versions = versionsResult.rows;
    return page;
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
  const client = await db.pool.connect();

  try {
    // Authorization check
    if (!userId) {
      throw new Error('Unauthorized: User ID is required');
    }

    await client.query('BEGIN');

    // 1. Get current page
    const getPageQuery = 'SELECT * FROM static_pages WHERE slug = $1 FOR UPDATE';
    const pageResult = await client.query(getPageQuery, [slug]);

    if (pageResult.rows.length === 0) {
      throw new Error(`Page not found: ${slug}`);
    }

    const page = pageResult.rows[0];

    // 2. Create version snapshot of current state
    const versionQuery = `
      INSERT INTO static_page_versions 
      (static_page_id, version_number, title, content, created_at, created_by)
      SELECT id, 
             COALESCE((SELECT MAX(version_number) FROM static_page_versions WHERE static_page_id = $1), 0) + 1,
             title, content, CURRENT_TIMESTAMP, $2
      FROM static_pages WHERE id = $1
      RETURNING version_number
    `;
    await client.query(versionQuery, [page.id, userId]);

    // 3. Update page with new sanitized content
    const sanitizedContent = sanitizeHtml(pageData.content);
    const updateQuery = `
      UPDATE static_pages
      SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3
      WHERE id = $4
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [
      pageData.title || page.title,
      sanitizedContent,
      userId,
      page.id
    ]);

    // 4. Prune old versions (keep last 10)
    const pruneQuery = `
      DELETE FROM static_page_versions
      WHERE static_page_id = $1 AND id NOT IN (
        SELECT id FROM static_page_versions
        WHERE static_page_id = $1
        ORDER BY version_number DESC
        LIMIT 10
      )
    `;
    await client.query(pruneQuery, [page.id]);

    await client.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error updating page ${slug}:`, error);
    throw error;
  } finally {
    client.release();
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
    // Authorization check
    if (!userId) {
      throw new Error('Unauthorized: User ID is required');
    }

    const query = `
      UPDATE static_pages
      SET published = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2
      WHERE slug = $3
      RETURNING *
    `;
    const result = await db.query(query, [published, userId, slug]);

    if (result.rows.length === 0) {
      throw new Error(`Page not found: ${slug}`);
    }

    return result.rows[0];
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
    const query = `
      SELECT v.version_number, v.title, v.created_at, v.created_by
      FROM static_page_versions v
      JOIN static_pages p ON v.static_page_id = p.id
      WHERE p.slug = $1
      ORDER BY v.version_number DESC
    `;
    const result = await db.query(query, [slug]);
    return result.rows;
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
  const client = await db.pool.connect();

  try {
    if (!userId) {
      throw new Error('Unauthorized: User ID is required');
    }

    await client.query('BEGIN');

    // Get page id
    const pageRes = await client.query('SELECT id FROM static_pages WHERE slug = $1', [slug]);
    if (pageRes.rows.length === 0) throw new Error(`Page not found: ${slug}`);
    const pageId = pageRes.rows[0].id;

    // Get target version
    const versionRes = await client.query(
      'SELECT title, content FROM static_page_versions WHERE static_page_id = $1 AND version_number = $2',
      [pageId, versionNumber]
    );

    if (versionRes.rows.length === 0) {
      throw new Error(`Version ${versionNumber} not found for ${slug}`);
    }
    const targetVersion = versionRes.rows[0];

    // Snapshot current state
    const snapshotQuery = `
      INSERT INTO static_page_versions 
      (static_page_id, version_number, title, content, created_at, created_by)
      SELECT id, 
             COALESCE((SELECT MAX(version_number) FROM static_page_versions WHERE static_page_id = $1), 0) + 1,
             title, content, CURRENT_TIMESTAMP, $2
      FROM static_pages WHERE id = $1
    `;
    await client.query(snapshotQuery, [pageId, userId]);

    // Restore
    const updateQuery = `
      UPDATE static_pages
      SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3
      WHERE id = $4
      RETURNING *
    `;
    const result = await client.query(updateQuery, [
      targetVersion.title,
      targetVersion.content,
      userId,
      pageId
    ]);

    await client.query('COMMIT');

    return {
      ...result.rows[0],
      restored_from_version: versionNumber
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error restoring version for ${slug}:`, error);
    throw error;
  } finally {
    client.release();
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
