const CacheService = require('./CacheService');

// Placeholder data
const announcements = [
    {
        id: 1,
        title: 'Welcome to our new website!',
        content: 'We are excited to launch our new digital home.',
        date: new Date('2026-02-01')
    }
];

class AnnouncementService {
    async getAll() {
        const cacheKey = 'announcement:all';
        const cached = await CacheService.get(cacheKey);

        if (cached) {
            return cached.map(a => ({
                ...a,
                date: new Date(a.date)
            }));
        }

        const data = announcements;

        // Cache for 2 minutes
        await CacheService.set(cacheKey, data, 120);

        return data;
    }

    async create(announcementData) {
        // In real implementation, this would insert to DB
        const newAnnouncement = {
            id: announcements.length + 1,
            ...announcementData,
            date: new Date()
        };
        announcements.push(newAnnouncement);

        // Invalidate cache
        await CacheService.del('announcement:all');

        return newAnnouncement;
    }

    async update(id, announcementData) {
        // In real implementation, this would update DB
        const index = announcements.findIndex(a => a.id === id);
        if (index === -1) {
            throw new Error('Announcement not found');
        }

        announcements[index] = {
            ...announcements[index],
            ...announcementData
        };

        // Invalidate cache
        await CacheService.del('announcement:all');
        await CacheService.del(`announcement:${id}`);

        return announcements[index];
    }

    async delete(id) {
        // In real implementation, this would delete from DB
        const index = announcements.findIndex(a => a.id === id);
        if (index === -1) {
            throw new Error('Announcement not found');
        }

        announcements.splice(index, 1);

        // Invalidate cache
        await CacheService.del('announcement:all');
        await CacheService.del(`announcement:${id}`);

        return true;
    }
}

module.exports = new AnnouncementService();
