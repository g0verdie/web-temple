const EventService = require('../services/EventService');
const StreamingService = require('../services/StreamingService');

/**
 * Calculate time remaining until next service
 * @param {Date} serviceDate - The date of the next service
 * @returns {Object} Object with days, hours, minutes, seconds
 */
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

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatEventDate(date) {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

function buildUnavailableStreamViewModel() {
  return {
    status: 'unavailable',
    isLive: false,
    title: "Temple B'nai Israel Live Service",
    embedUrl: null,
    watchUrl: null,
    scheduledStart: null,
    formattedScheduledStart: null,
    iframeTitle: 'Temple B\'nai Israel livestream',
    helperText: 'The livestream is temporarily unavailable. Please check back shortly.',
    fallbackActionLabel: null
  };
}

function buildStreamViewModel(streamMetadata) {
  const scheduledStart = streamMetadata && streamMetadata.scheduledStart
    ? new Date(streamMetadata.scheduledStart)
    : null;

  const isValidScheduledStart = scheduledStart && !Number.isNaN(scheduledStart.getTime());
  const formattedScheduledStart = isValidScheduledStart ? formatEventDate(scheduledStart) : null;
  const title = (streamMetadata && streamMetadata.title) || "Temple B'nai Israel Live Service";

  if (!streamMetadata || streamMetadata.status === 'unavailable') {
    return {
      ...buildUnavailableStreamViewModel(),
      title,
      watchUrl: streamMetadata && streamMetadata.watchUrl ? streamMetadata.watchUrl : null,
      scheduledStart: isValidScheduledStart ? scheduledStart : null,
      formattedScheduledStart
    };
  }

  if (streamMetadata.status === 'live' && streamMetadata.embedUrl) {
    return {
      status: 'live',
      isLive: true,
      title,
      embedUrl: streamMetadata.embedUrl,
      watchUrl: streamMetadata.watchUrl || null,
      scheduledStart: isValidScheduledStart ? scheduledStart : null,
      formattedScheduledStart,
      iframeTitle: `${title} livestream player`,
      helperText: 'If playback does not start automatically, press play in the player or use the Facebook link.',
      fallbackActionLabel: streamMetadata.watchUrl ? 'Watch on Facebook' : null
    };
  }

  return {
    status: 'inactive',
    isLive: false,
    title,
    embedUrl: null,
    watchUrl: streamMetadata.watchUrl || null,
    scheduledStart: isValidScheduledStart ? scheduledStart : null,
    formattedScheduledStart,
    iframeTitle: `${title} livestream player`,
    helperText: 'The livestream will appear here when services go live.',
    fallbackActionLabel: null
  };
}

/**
 * Homepage controller
 * Renders the homepage with mission, countdown, and upcoming events
 */
exports.getHomepage = async (req, res) => {
  try {
    const [nextService, events, rawStream] = await Promise.all([
      EventService.getNextService(),
      EventService.getUpcomingEvents(3),
      StreamingService.getPublicEmbedMetadata().catch(() => buildUnavailableStreamViewModel())
    ]);

    let countdown = null;
    if (nextService) {
      countdown = getTimeUntilService(new Date(nextService.date));
    }

    const formattedEvents = events.map(event => ({
      ...event,
      formattedDate: formatEventDate(new Date(event.date))
    }));

    const stream = buildStreamViewModel(rawStream);

    res.render('layout', {
      title: 'Temple B\'nai Israel - Welcome Home',
      bodyView: 'home',
      viewData: {
        mission: {
          headline: 'Welcome to Temple B\'nai Israel',
          statement: 'A warm, inclusive Jewish community in Hattiesburg, MS, celebrating tradition, fostering spiritual growth, and building lasting connections.',
          cta: {
            text: 'New Here? Learn More',
            link: '/about'
          }
        },
        nextService,
        countdown,
        events: formattedEvents,
        stream,
        formatEventDate
      }
    });
  } catch (error) {
    console.error('Error rendering homepage:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Export helper functions for testing
exports.getTimeUntilService = getTimeUntilService;
exports.formatEventDate = formatEventDate;

