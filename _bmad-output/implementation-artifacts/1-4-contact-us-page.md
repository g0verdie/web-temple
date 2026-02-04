# Story 1.4: Contact Us Page

**Story ID:** 1.4
**Status:** ready-for-dev
**Epic:** Project Foundation & Content Discovery

## Story

As a **public visitor**,
I want to view a "Contact Us" page and submit a message protected by CAPTCHA,
So that I can reach out to the temple leadership with questions or comments without spamming them.

## Acceptance Criteria

1.  **Contact Page Navigation**: The Contact page is accessible from the main navigation menu `[FR7]`.
2.  **Page Content**: Displays:
    - Temple address and map (embedded Google Maps or similar)
    - Phone number and email address
    - Office hours
    - Contact form `[FR44]`
3.  **Contact Form Fields**:
    - Name (required)
    - Email (required, valid format)
    - Subject (required)
    - Message (required, min 10 chars)
4.  **Security (CAPTCHA)**: Form is protected by hCaptcha (or similar) to prevent spam `[FR106, NFR-S7]`.
5.  **Submission Handling**:
    - On success: Show localized success message ("Thank you, we will reply soon").
    - On failure: Show clear error message.
    - Data is stored in `messages` table `[FR49]`.
    - Email notification sent to Rabbi/Admin `[FR45]`.
6.  **Responsive Design**: Layout adjusts for mobile (stacked), tablet, and desktop (side-by-side details + form) `[FR77, FR78, FR79]`.
7.  **Accessibility**:
    - Focus management on form validation errors.
    - Labels explicitly associated with inputs `[FR74]`.
    - 4.5:1 contrast ratio `[FR73]`.
8.  **Performance**: Page loads in <2s `[NFR-P1]`.

## Tasks / Subtasks

- [ ] **Task 1: Database Schema for Messages**
    - [ ] Create `messages` table:
        - `id` (UUID)
        - `name`, `email`, `subject`, `message` (Text)
        - `status` (Enum: 'new', 'read', 'replied', 'archived')
        - `created_at` (Timestamp)
        - `user_id` (Nullable, for logged-in members)
    - [ ] Create migration file.

- [ ] **Task 2: Backend Route & Controller**
    - [ ] Create `src/routes/messages.js` (POST /)
    - [ ] Create `src/controllers/messageController.js`
    - [ ] Implement `submitMessage` handler
    - [ ] Validate input (express-validator)
    - [ ] Verify CAPTCHA token (server-side verify)
    - [ ] Insert into DB

- [ ] **Task 3: Contact Page UI**
    - [ ] Create `src/views/contact.ejs`
    - [ ] Implement layout with Address/Map and Form
    - [ ] Add client-side validation logic (JS)
    - [ ] styling in `public/css/contact.css` (Tailwind/CSS variables)

- [ ] **Task 4: Notification System**
    - [ ] Integrate nodemailer (or reuse existing email service if setup)
    - [ ] Send "New Contact Message" email to Admin/Rabbi email address
    - [ ] (Optional) Send "Receipt" email to visitor

- [ ] **Task 5: Security Integration**
    - [ ] Register for hCaptcha/reCAPTCHA keys (free tier)
    - [ ] Configure keys in `.env`
    - [ ] Add widget to frontend
    - [ ] Add verification logic to backend

- [ ] **Task 6: Testing**
    - [ ] Unit Test `messageController` (mock DB, mock CAPTCHA)
    - [ ] Integration Test POST `/contact` (success/fail flows)
    - [ ] Accessibility Test (axe, keyboard nav)

## Dev Notes

### Architecture Patterns
- **Services**: Use `MessageService` if extracting logic, otherwise Controller is fine for MVP.
- **Validation**: Strict server-side validation is mandatory.
- **Security**: Never trust client-side CAPTCHA; always verify token with provider API.

### Project Structure Notes
- Routes: `src/routes/contact.js` (GET) and `src/routes/api/messages.js` (POST) or unified? -> Unified `src/routes/contact.js` handling GET (view) and POST (submit).
- Views: `src/views/contact.ejs`.

### References
- [PRD FR7, FR44, FR106](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/prd.md)
- [Architecture Security](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used
BMad Master (AntiGravity)

### Debug Log References
- No debug logs yet.

### Completion Notes List
- 

### File List
- `src/routes/contact.js`
- `src/controllers/contactController.js`
- `src/views/contact.ejs`
- `public/css/contact.css`
- `src/models/message.js` (or schema migration)
- `tests/contact.test.js`
