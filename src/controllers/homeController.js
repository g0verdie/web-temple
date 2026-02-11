const EventService = require('../services/EventService');

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

/**
 * Homepage controller
 * Renders the homepage with mission, countdown, and upcoming events
 */
exports.getHomepage = async (req, res) => {
  try {
    const nextService = await EventService.getNextService();
    const events = await EventService.getUpcomingEvents(3);

    // Calculate countdown for next service
    let countdown = null;
    if (nextService) {
      countdown = getTimeUntilService(new Date(nextService.date));
    }

    // Format event dates for display
    const formattedEvents = events.map(event => ({
      ...event,
      formattedDate: formatEventDate(new Date(event.date))
    }));

    res.render('layout', {
      title: 'Temple B\'nai Israel - Welcome Home',
      bodyView: 'home',
      viewData: {
        mission: {
          headline: 'Welcome to Temple B\'nai Israel',
          statement: 'A warm, inclusive Jewish community in Hattiesburg, MS, celebrating tradition, fostering spiritual growth, and building lasting connections.',
          cta: {
            text: 'New Here? Learn More',
            link: '/visit-us'
          }
        },
        nextService,
        countdown,
        events: formattedEvents,
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

