/** @jest-environment jsdom */

describe('stream-status client behavior', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-23T12:00:00.000Z'));
    document.body.innerHTML = '';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'offline', statusLabel: 'Offline', message: 'Offline now', archiveCta: true })
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete global.fetch;
  });

  it('updates SSR upcoming countdown on first render', () => {
    document.body.innerHTML = `
      <section id="live-stream-container">
        <div class="stream-countdown" data-countdown-target="2026-03-23T12:01:10.000Z"></div>
      </section>
    `;

    require('../../public/js/stream-status.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    jest.advanceTimersByTime(1000);

    const countdown = document.querySelector('.stream-countdown');
    expect(countdown.textContent).toContain('Starts in:');
  });

  it('polls stream status immediately on load', async () => {
    document.body.innerHTML = '<section id="live-stream-container"></section>';

    require('../../public/js/stream-status.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();

    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/stream/status');
  });

  it('renders the server temple-timezone label for an upcoming stream without local reformatting', async () => {
    // The card must display the server's preformatted temple-zone string verbatim,
    // NOT reformat the raw instant in the viewer's browser-local zone (cross-surface
    // drift). To prove this independently of whatever timezone the test runner sits
    // in, the server label deliberately names a different date than any local
    // rendering of scheduledStart (July 4/5) could ever produce: the old, drifting
    // client reformatted the instant and would print "July", never "December".
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'upcoming',
        statusLabel: 'Upcoming',
        message: 'The livestream will begin shortly.',
        scheduledStart: '2099-07-04T19:00:00Z',
        countdownTarget: '2099-07-04T19:00:00Z',
        formattedScheduledStart: 'Monday, December 25, 2099 at 8:30 AM'
      })
    });

    document.body.innerHTML = '<section id="live-stream-container"></section>';

    require('../../public/js/stream-status.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const schedule = document.querySelector('.stream-schedule');
    expect(schedule).not.toBeNull();
    expect(schedule.textContent).toBe('Next scheduled stream: Monday, December 25, 2099 at 8:30 AM');
    // A locally-reformatted instant would print "July"; its absence proves the client
    // never re-derives the time in the viewer's timezone.
    expect(document.getElementById('live-stream-container').innerHTML).not.toContain('July');
  });

  it('renders the offline fallback CTA pointing at /watch (not the retired /archive)', async () => {
    // beforeEach mocks an offline response with archiveCta:true.
    document.body.innerHTML = '<section id="live-stream-container"></section>';

    require('../../public/js/stream-status.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Settle the immediate poll's fetch().then(json).then(updateDOM) chain.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const container = document.getElementById('live-stream-container');
    expect(container.innerHTML).toContain('href="/watch"');
    expect(container.innerHTML).toContain('Watch Past Services');
    expect(container.innerHTML).not.toContain('/archive');
    expect(container.innerHTML).not.toContain('View Recordings');
  });

  it('preserves the live iframe node when polling returns the same live stream', async () => {
    const liveResponse = {
      status: 'live',
      statusLabel: 'LIVE NOW',
      title: 'Friday Evening Shabbat Service',
      embedUrl: 'https://www.facebook.com/plugins/video.php?href=123',
      watchUrl: 'https://www.facebook.com/temple/videos/123',
      message: 'Join us live.'
    };

    document.body.innerHTML = `
      <section id="live-stream-container">
        <div class="stream-header">
          <h3 id="stream-heading" class="section-title">Live Stream</h3>
          <span class="stream-badge stream-badge--live" role="status" aria-live="polite" aria-atomic="true" aria-label="LIVE NOW">LIVE NOW</span>
        </div>
        <div class="stream-card">
          <div class="stream-player-frame">
            <iframe src="https://www.facebook.com/plugins/video.php?href=123" title="Friday Evening Shabbat Service livestream player"></iframe>
          </div>
          <div class="stream-details">
            <p class="stream-title">Friday Evening Shabbat Service</p>
            <p class="stream-helper">Join us live.</p>
            <a href="https://www.facebook.com/temple/videos/123" class="stream-link">Watch on Facebook</a>
          </div>
        </div>
      </section>
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => liveResponse
    });

    require('../../public/js/stream-status.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();

    const iframe = document.querySelector('iframe');

    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.querySelector('iframe')).toBe(iframe);
    expect(document.querySelector('.stream-title').textContent).toBe('Friday Evening Shabbat Service');
  });

  it('shows an error state after one retry window when polling keeps failing', async () => {
    document.body.innerHTML = `
      <section id="live-stream-container">
        <div class="stream-header">
          <h3 id="stream-heading" class="section-title">Live Stream</h3>
          <span class="stream-badge stream-badge--live" role="status" aria-live="polite" aria-atomic="true" aria-label="LIVE NOW">LIVE NOW</span>
        </div>
        <div class="stream-card">
          <div class="stream-player-frame">
            <iframe src="https://www.facebook.com/plugins/video.php?href=123" title="Friday Evening Shabbat Service livestream player"></iframe>
          </div>
          <div class="stream-details">
            <p class="stream-title">Friday Evening Shabbat Service</p>
          </div>
        </div>
      </section>
    `;

    global.fetch = jest.fn().mockRejectedValue(new Error('Network down'));

    require('../../public/js/stream-status.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();

    expect(document.querySelector('.stream-card iframe')).not.toBeNull();

    jest.advanceTimersByTime(30000);
    await Promise.resolve();
    expect(document.querySelector('.stream-card iframe')).not.toBeNull();

    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.querySelector('.stream-card iframe')).toBeNull();
    expect(document.querySelector('.stream-helper').textContent).toContain('trouble refreshing livestream status');
    expect(document.querySelector('.stream-badge').textContent).toBe('Stream Error');
  });
});
