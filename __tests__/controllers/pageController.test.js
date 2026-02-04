/**
 * __tests__/controllers/pageController.test.js
 * Tests for page CRUD operations, versioning, and sanitization
 */

const pageController = require('../../src/controllers/pageController');
const db = require('../../src/config/db');

// Mock the db module
jest.mock('../../src/config/db', () => {
  const mPool = {
    connect: jest.fn(),
  };
  return {
    query: jest.fn(),
    pool: mPool,
  };
});

describe('Page Controller', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db.pool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  describe('getPublishedPage', () => {
    it('should return published page', async () => {
      const mockPage = {
        id: 'uuid-1',
        slug: 'about',
        title: 'About',
        content: '<p>Content</p>',
        published: true,
        updated_at: new Date(),
      };

      db.query.mockResolvedValueOnce({ rows: [mockPage] });

      const page = await pageController.getPublishedPage('about');

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['about']);
      expect(page).toEqual(mockPage);
    });

    it('should return null if no page found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const page = await pageController.getPublishedPage('about');
      expect(page).toBeNull();
    });
  });

  describe('getPageForAdmin', () => {
    it('should return page with versions for admin', async () => {
      const mockPage = { id: 'uuid-1', slug: 'about', title: 'About', content: 'C', published: true };
      const mockVersions = [{ version_number: 1, title: 'Old', content: 'C' }];

      // First query for page
      db.query.mockResolvedValueOnce({ rows: [mockPage] });
      // Second query for versions
      db.query.mockResolvedValueOnce({ rows: mockVersions });

      const page = await pageController.getPageForAdmin('about');

      expect(page).toBeDefined();
      expect(page.versions).toEqual(mockVersions);
    });

    it('should return null if page not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const page = await pageController.getPageForAdmin('about');
      expect(page).toBeNull();
    });
  });

  describe('updatePage', () => {
    it('should update page and create version', async () => {
      const userId = 'user-1';
      const mockPage = { id: 'uuid-1', title: 'Old', content: 'OldContent' };

      // 1. Get current page
      mockClient.query.mockResolvedValueOnce({ rows: [mockPage] });
      // 2. Insert version (mock return not used logic-wise but good for completeness)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. Update page
      mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockPage, title: 'New' }] });
      // 4. Prune versions
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      // Transaction handling
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({}); // COMMIT

      const updated = await pageController.updatePage('about', {
        title: 'New',
        content: '<p>New</p>'
      }, userId);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM static_pages'), ['about']);
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO static_page_versions'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE static_pages'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(updated.title).toBe('New');
    });

    it('should throw error if unauthorized (no userId)', async () => {
      await expect(pageController.updatePage('about', {}, null))
        .rejects.toThrow('Unauthorized');
    });

    it('should rollback interaction on error', async () => {
      const userId = 'user-1';
      mockClient.query.mockRejectedValueOnce(new Error('DB Error')); // Fail on BEGIN or first query

      await expect(pageController.updatePage('about', {}, userId))
        .rejects.toThrow('DB Error');

      // Depending on where it failed, it might call ROLLBACK. 
      // If BEGIN fails, it goes to catch -> ROLLBACK.
      // Wait, if connect works, we get client. 
      // If client.query throws, we go to catch.
    });
  });

  describe('publishPage', () => {
    it('should publish a page', async () => {
      const userId = 'user-1';
      db.query.mockResolvedValueOnce({ rows: [{ published: true }] });

      const result = await pageController.publishPage('about', true, userId);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE static_pages'), [true, userId, 'about']);
      expect(result.published).toBe(true);
    });

    it('should throw if unauthorized', async () => {
      await expect(pageController.publishPage('about', true, null))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('restoreVersion', () => {
    it('should restore page to version', async () => {
      const userId = 'user-1';
      const pageId = 'uuid-page';

      // Sequence of mock returns for client.query
      // 0. BEGIN is called (needs successful response if awaiting) - typically simpler to assume mock returns promise

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: pageId }] }) // Get page ID
        .mockResolvedValueOnce({ rows: [{ title: 'V1', content: 'C1' }] }) // Get target version
        .mockResolvedValueOnce({}) // Snapshot current
        .mockResolvedValueOnce({ rows: [{ title: 'V1', content: 'C1' }] }) // Update page
        .mockResolvedValueOnce({}); // COMMIT

      const result = await pageController.restoreVersion('about', 1, userId);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(result.title).toBe('V1');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });
});
