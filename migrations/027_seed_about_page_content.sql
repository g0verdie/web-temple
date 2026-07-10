-- Migration: Seed the About page draft with letter-derived content
-- Date: 2026-07-08
-- Description: Replaces the 001 placeholder About draft (slug 'about') with
--   content authored from the congregation's welcome letter: identity and
--   Shoals history, Rabbi Nancy Tunick bio, the standing worship schedule,
--   and the membership contact. Guarded on the 001 placeholder content so a
--   hand-edited row is never clobbered (this migration no-ops instead).
--   Publish state is untouched: the page stays an unpublished draft until the
--   owner confirms the time-sensitive facts (see
--   docs/plans/2026-07-08-001-feat-temple-description-content-plan.md).
--   The HTML is committed in sanitizeHtml() fixed-point form so an admin
--   editor save round-trips it unchanged.

UPDATE static_pages
SET
  title = 'About Temple B''nai Israel — Reform Jewish Congregation in Florence, Alabama',
  content = $html$
<h2>Welcome to Temple B'nai Israel</h2>
<p>Temple B'nai Israel is a Reform Jewish congregation in practice, inclusive of Jewish families of all denominations as well as interfaith families. We have been a part of the Shoals community for well over 100 years. The Shoals community encompasses the cities of Florence, Muscle Shoals, Sheffield, and Tuscumbia, Alabama, along with the surrounding areas.</p>
<img src="/images/temple-building.jpg" alt="The front exterior of Temple B'nai Israel in Florence, Alabama" />
<h2>Our Rabbi</h2>
<p>Rabbi Nancy Tunick is a Nashville, Tennessee-based rabbi, cantorial soloist, and composer who has served congregations in Philadelphia, Pennsylvania; Meridian, Mississippi; and Jacksonville, Florida. Rabbi Tunick began serving Temple B'nai Israel as cantorial soloist and composer in 2000 and became our congregation's spiritual leader in 2008. She was ordained as a rabbi in July 2013.</p>
<h2>Worship and Study</h2>
<p>We hold services every Friday evening at 7:00pm. Approximately every other week, Rabbi Tunick travels from Nashville to lead us in worship. On the Friday nights when Rabbi Tunick cannot be with us, services are led by lay leaders within the congregation.</p>
<p>Every Saturday morning at 9:30am, a group of members, joined by others from the Shoals area, meets to study Torah.</p>
<p>We welcome anyone who would like to get to know us better, and we invite you to join us for our Friday evening services and our Saturday morning Torah study.</p>
<h2>Membership</h2>
<p>For membership or other information, please contact our congregation president at <a href="mailto:info@florencetemple.org" rel="noopener noreferrer">info@florencetemple.org</a>.</p>
$html$,
  updated_at = NOW()
WHERE slug = 'about'
  AND content LIKE '%vibrant and inclusive Jewish community%';
