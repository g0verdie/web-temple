// Static configuration for upcoming services/events
// In future stories, this will be replaced with database queries
const upcomingEvents = [
  {
    title: 'Kabbalat Shabbat Service',
    date: new Date('2026-02-07T19:00:00'),
    description: 'Join us for our welcoming Shabbat service with Rabbi Sarah',
    type: 'service',
    location: 'Main Sanctuary'
  },
  {
    title: 'Shabbat Morning Service',
    date: new Date('2026-02-08T10:00:00'),
    description: 'Traditional Shabbat morning service and Torah study',
    type: 'service',
    location: 'Main Sanctuary'
  },
  {
    title: 'Tu B\'Shvat Celebration',
    date: new Date('2026-02-12T18:30:00'),
    description: 'Celebrate the New Year for Trees with family activities',
    type: 'event',
    location: 'Community Hall'
  }
];

/**
 * Get the next upcoming service (not general event)
 * @returns {Object|null} Next service object or null if none found
 */
function getNextService() {
  const now = new Date();
  const upcomingServices = upcomingEvents
    .filter(event => event.type === 'service' && event.date > now)
    .sort((a, b) => a.date - b.date);
  
  return upcomingServices[0] || null;
}

/**
 * Get the next 3 upcoming events (services or events)
 * @returns {Array} Array of up to 3 upcoming events
 */
function getUpcomingEvents() {
  const now = new Date();
  return upcomingEvents
    .filter(event => event.date > now)
    .sort((a, b) => a.date - b.date)
    .slice(0, 3);
}

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
exports.getHomepage = (req, res) => {
  const nextService = getNextService();
  const events = getUpcomingEvents();
  
  // Calculate countdown for next service
  let countdown = null;
  if (nextService) {
    countdown = getTimeUntilService(nextService.date);
  }
  
  // Format event dates for display
  const formattedEvents = events.map(event => ({
    ...event,
    formattedDate: formatEventDate(event.date)
  }));
  
  res.render('home', {
    title: 'Temple B\'nai Israel - Welcome Home',
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
    formatEventDate: (date) => {
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
  });
};

// Export helper functions for testing
exports.getTimeUntilService = getTimeUntilService;
exports.getNextService = getNextService;
exports.getUpcomingEvents = getUpcomingEvents;
exports.formatEventDate = formatEventDate;
