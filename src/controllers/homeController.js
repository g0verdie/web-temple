const EventService = require('../services/EventService');
const StreamingService = require('../services/StreamingService');
const AnnouncementService = require('../services/AnnouncementService');
const logger = require('../utils/logger');
const { formatEventDateTime } = require('../utils/templeTime');

function getTimeUntilService(serviceDate) {
  const now = new Date();
  const diff = serviceDate - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

// Delegates to the one temple-timezone formatter so the homepage next-service
// time and upcoming events match every other surface.
function formatEventDate(date) {
  return formatEventDateTime(date);
}

function buildStreamViewModel(streamMetadata) {
  const viewModel = { ...streamMetadata };
  
  if (viewModel.scheduledStart) {
    const scheduledStart = new Date(viewModel.scheduledStart);
    if (!Number.isNaN(scheduledStart.getTime())) {
      viewModel.formattedScheduledStart = formatEventDate(scheduledStart);
    }
  }

  if (viewModel.status === 'live' && viewModel.title) {
    viewModel.iframeTitle = `${viewModel.title} livestream player`;
  }
  
  return viewModel;
}

exports.getHomepage = async (req, res) => {
  try {
    const defaultErrorState = {
      status: 'error',
      fallbackUrl: 'https://www.facebook.com/share/18jfSPTgMw/',
      message: 'The streaming provider is currently unavailable. Please watch directly on Facebook.'
    };

    const [nextService, events, rawStream, announcements] = await Promise.all([
      EventService.getNextService(),
      EventService.getUpcomingEvents(3),
      StreamingService.getPublicEmbedMetadata().catch(() => defaultErrorState),
      AnnouncementService.getHomepageAnnouncements(5).catch(() => [])
    ]);

    let countdown = null;
    if (nextService) {
      countdown = getTimeUntilService(new Date(nextService.date));
    }

    const formattedEvents = events.map(event => ({
      ...event,
      formattedDate: formatEventDate(new Date(event.date))
    }));

    const stream = buildStreamViewModel(rawStream || defaultErrorState);

    res.render('layout', {
      title: 'Temple B\'nai Israel — Reform Jewish Congregation in Florence, AL',
      description: 'Temple B\'nai Israel is a Reform Jewish congregation in Florence, AL, welcoming families of all denominations and interfaith families across the Shoals. Watch live services, see upcoming events, and connect with our congregation.',
      bodyView: 'home',
      stylesheets: ['/css/announcements.css'],
      viewData: {
        mission: {
          headline: 'Welcome to Temple B\'nai Israel',
          statement: 'A warm Reform Jewish congregation rooted in the Shoals for more than a century, welcoming Jewish families of all denominations and interfaith families.',
          cta: {
            text: 'New Here? Learn More',
            link: '/about'
          }
        },
        nextService,
        countdown,
        events: formattedEvents,
        announcements,
        stream,
        formatEventDate
      }
    });
  } catch (error) {
    logger.error(`Error rendering homepage: ${error.message}`, { stack: error.stack });
    res.status(500).render('error', {
      title: '500 - Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
};

exports.getTimeUntilService = getTimeUntilService;
exports.formatEventDate = formatEventDate;
