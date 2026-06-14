const DonationService = require('../services/DonationService');
const logger = require('../utils/logger');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');

const str = (v) => (typeof v === 'string' ? v : '');

// GET /admin/donations — financial dashboard (Rabbi/Admin/Treasurer).
exports.getDashboard = async (req, res) => {
    try {
        const rawPage = str(req.query.page);
        if (rawPage && !/^[1-9]\d{0,3}$/.test(rawPage)) {
            return res.status(400).render('error', { title: '400 - Invalid Request', message: 'Invalid page number' });
        }
        const page = rawPage ? parseInt(rawPage, 10) : 1;

        const filters = {
            page,
            limit: 20,
            donationType: ['one-time', 'recurring'].includes(str(req.query.type)) ? str(req.query.type) : undefined,
            isAnonymous: req.query.anon === 'true' ? true : (req.query.anon === 'false' ? false : undefined),
            startDate: str(req.query.startDate) || undefined,
            endDate: str(req.query.endDate) || undefined
        };

        const [metrics, list] = await Promise.all([
            DonationService.getDashboardMetrics(),
            DonationService.listDonations(filters)
        ]);

        logAudit({
            user_id: req.user && req.user.id,
            action: AUDIT_ACTIONS.DONATIONS_ACCESSED,
            entity_type: 'donation',
            description: 'Viewed donation dashboard'
        }).catch((err) => logger.error('Audit log error:', err));

        return res.render('layout', {
            title: 'Donations - Admin',
            bodyView: 'admin/donations',
            stylesheets: ['/css/donations.css'],
            viewData: {
                metrics,
                donations: list.donations,
                currentPage: list.currentPage,
                totalPages: list.totalPages,
                totalCount: list.totalCount,
                filters: {
                    type: filters.donationType || '',
                    anon: req.query.anon || '',
                    startDate: filters.startDate || '',
                    endDate: filters.endDate || ''
                }
            }
        });
    } catch (error) {
        logger.error('Error loading donation dashboard:', error);
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load donations.' });
    }
};

// GET /admin/donations/export.csv — accounting export.
exports.exportCsv = async (req, res) => {
    try {
        const { donations } = await DonationService.listDonations({ page: 1, limit: 10000 });
        const csv = DonationService.toCsv(donations);
        logAudit({
            user_id: req.user && req.user.id,
            action: AUDIT_ACTIONS.DONATIONS_ACCESSED,
            entity_type: 'donation',
            description: 'Exported donations CSV'
        }).catch((err) => logger.error('Audit log error:', err));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
        return res.send(csv);
    } catch (error) {
        logger.error('Error exporting donations CSV:', error);
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to export donations.' });
    }
};
