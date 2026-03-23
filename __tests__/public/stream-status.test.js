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
