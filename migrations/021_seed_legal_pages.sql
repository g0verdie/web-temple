-- Migration: Seed public legal pages (privacy, terms, accessibility)
-- Date: 2026-06-15
-- Description: Inserts published static_pages rows for the /privacy, /terms, and
--   /accessibility routes. Content is placeholder text pending legal review and
--   is editable by admins via /admin/pages/:slug. Idempotent via ON CONFLICT.
--   NOTE: this content is NOT a substitute for review by qualified counsel.

INSERT INTO static_pages (slug, title, content, published)
VALUES (
  'privacy',
  'Privacy Policy',
  $html$
<p><em>Last updated: June 2026. This policy is a template pending review by legal counsel.</em></p>
<h2>Who we are</h2>
<p>Temple B'nai Israel ("we," "us," or "the Temple") operates this website. If you have questions about this policy, contact us at <a href="mailto:info@florencetemple.org">info@florencetemple.org</a> or (256) 764-9242.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Account information</strong> you provide when you register, such as your name and email address.</li>
<li><strong>Donation information</strong> processed when you give. Payments are handled by our third-party payment processor; we do not store full payment card numbers.</li>
<li><strong>Messages</strong> you send us through contact or chat features.</li>
<li><strong>Technical data</strong> such as session cookies used to keep you signed in and to protect against fraud.</li>
</ul>
<h2>How we use your information</h2>
<p>We use your information to operate the site, process donations and issue receipts, send communications you have opted into, respond to your messages, and maintain the security of our services.</p>
<h2>Email preferences</h2>
<p>You may opt out of non-essential emails at any time using the unsubscribe link in any message or from your <a href="/account/settings">account settings</a>.</p>
<h2>Sharing</h2>
<p>We do not sell your personal information. We share information only with service providers who help us operate the site (such as our payment processor and email provider), and when required by law.</p>
<h2>Data retention and your rights</h2>
<p>We retain personal information for as long as needed to provide our services and meet legal obligations. To request access to, correction of, or deletion of your information, contact us at <a href="mailto:info@florencetemple.org">info@florencetemple.org</a>.</p>
<h2>Changes</h2>
<p>We may update this policy from time to time. Material changes will be posted on this page.</p>
$html$,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO static_pages (slug, title, content, published)
VALUES (
  'terms',
  'Terms of Use',
  $html$
<p><em>Last updated: June 2026. These terms are a template pending review by legal counsel.</em></p>
<h2>Acceptance of terms</h2>
<p>By accessing or using this website, you agree to these Terms of Use. If you do not agree, please do not use the site.</p>
<h2>Use of the site</h2>
<p>You agree to use the site lawfully and not to disrupt it, attempt unauthorized access, or misuse its features. Content on the site is provided for the benefit of our community.</p>
<h2>Accounts</h2>
<p>You are responsible for maintaining the confidentiality of your account credentials and for activity that occurs under your account.</p>
<h2>Donations</h2>
<p>Donations are processed through a third-party payment provider. Temple B'nai Israel is a recognized nonprofit; a receipt is issued for your records. Please contact us with any questions about a donation.</p>
<h2>Disclaimer and limitation of liability</h2>
<p>The site is provided "as is" without warranties of any kind. To the fullest extent permitted by law, the Temple is not liable for damages arising from your use of the site.</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of the State of Alabama, without regard to its conflict-of-laws principles.</p>
<h2>Changes</h2>
<p>We may revise these terms from time to time. Continued use of the site after changes are posted constitutes acceptance.</p>
<h2>Contact</h2>
<p>Questions about these terms may be sent to <a href="mailto:info@florencetemple.org">info@florencetemple.org</a>.</p>
$html$,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO static_pages (slug, title, content, published)
VALUES (
  'accessibility',
  'Accessibility Statement',
  $html$
<p><em>Last updated: June 2026.</em></p>
<h2>Our commitment</h2>
<p>Temple B'nai Israel is committed to making this website accessible to everyone, including people with disabilities. We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.</p>
<h2>Measures we take</h2>
<ul>
<li>Semantic HTML with landmarks, headings, and descriptive labels.</li>
<li>Keyboard navigation and a skip-to-content link.</li>
<li>Text alternatives for meaningful images and sufficient color contrast.</li>
<li>Accessibility checks as part of our development process.</li>
</ul>
<h2>Known limitations</h2>
<p>Some third-party content, such as embedded video, may not yet be fully accessible. We are working to address these areas.</p>
<h2>Feedback</h2>
<p>If you encounter an accessibility barrier, please tell us so we can fix it. Contact <a href="mailto:info@florencetemple.org">info@florencetemple.org</a> or call (256) 764-9242, and we will work with you to provide the information or service you need.</p>
$html$,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;
