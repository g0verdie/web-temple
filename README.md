# Temple B'nai Israel Website

A modern, accessible temple website with live streaming and community features.

## Project Overview

This is a Multi-Page Application (MPA) built with Node.js/Express, featuring server-rendered HTML for optimal performance and accessibility. The project follows WCAG AA standards and is designed for self-hosted deployment.

## Tech Stack

- **Backend**: Node.js v18+, Express v4+
- **Templating**: EJS
- **Testing**: Jest, Supertest
- **Security**: Helmet (CSP), HTTPS
- **Performance**: Compression middleware

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch
```

### Production

```bash
# Start production server
npm start
```

## Project Structure

```
web-temple/
├── src/
│   ├── controllers/      # Request handlers
│   ├── routes/           # Route definitions
│   ├── views/            # EJS templates
│   └── server.js         # Express app setup
├── public/
│   └── css/              # Stylesheets
├── __tests__/            # Test files
├── _bmad-output/         # Planning artifacts
│   ├── planning-artifacts/
│   │   ├── prd.md
│   │   ├── architecture.md
│   │   └── epics.md
│   └── implementation-artifacts/
│       ├── sprint-status.yaml
│       └── 1-1-homepage-with-temple-mission-upcoming-services.md
└── package.json
```

## Current Implementation Status

### ✅ Story 1.1: Homepage with Mission & Upcoming Services

**Completed Features:**
- Homepage with mission statement above the fold
- Real-time countdown timer to next service
- Display of 3 upcoming events
- WCAG AA compliant (4.5:1 contrast, semantic HTML, keyboard navigation)
- Mobile-first responsive design (375px-1200px+)
- Comprehensive test coverage (100% statements, 75% branches)

**Status**: Ready for code review

## Development Workflow

This project follows the BMad Method for structured development:

1. **Planning**: PRD → Architecture → Epics → Stories
2. **Implementation**: Story creation → Dev implementation → Tests
3. **Review**: Code review → QA → Deployment

See `_bmad-output/` for complete planning artifacts and story details.

## Accessibility

This website is designed to meet WCAG AA standards:

- Semantic HTML with proper landmarks
- 4.5:1 minimum color contrast
- 3px focus indicators for keyboard navigation
- Skip links for screen reader users
- ARIA labels and live regions for dynamic content

## Performance

Target performance metrics (NFR-P1):
- Homepage: <2 seconds on 5G connection
- Static content caching for optimal load times
- Compression middleware enabled

## License

UNLICENSED - Private project for Temple B'nai Israel

## Contact

Developer: Ilya
