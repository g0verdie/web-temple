const CuratedSource = require('./CuratedSource');
const GraphApiSource = require('./GraphApiSource');

/**
 * Select the active past-video source by env. Defaults to the curated list — the
 * MVP / Board-demo source that needs no Facebook credentials. Set
 * PAST_VIDEO_SOURCE=graph once a long-lived Page Access Token lands to auto-pull
 * from the temple's Facebook Page behind the same PastVideoSource interface.
 * (The curated source also serves as the runtime fallback in PastVideoService.)
 */
let source = null;

const getSource = () => {
    if (source) return source;
    const name = (process.env.PAST_VIDEO_SOURCE || 'curated').toLowerCase();
    switch (name) {
        case 'graph':
            source = new GraphApiSource();
            break;
        case 'curated':
        default:
            source = new CuratedSource();
            break;
    }
    return source;
};

// Test helper to reset the memoized source between cases.
const _reset = () => { source = null; };

module.exports = { getSource, _reset };
