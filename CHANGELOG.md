# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Features to be released

### Changed
- Changes to be released

### Fixed
- Fixes to be released

## [2.7.0] - 2025-07-15
### Added
- New Claude models support:
  - `claude-sonnet-4-20250514`
  - `claude-opus-4-20250514`

## [2.6.0] - 2025-07-05
### Added
- New Gemini models support:
  - `gemini-2.0-flash`
  - `gemini-2.0-flash-lite`
  - `gemini-2.5-flash-preview-05-20`
  - `gemini-2.5-flash-preview-04-17`
  - `gemini-2.5-pro-preview-05-06`
- New Perplexity Sonar models support:
  - `sonar-reasoning-pro`
  - `sonar-reasoning`
  - `sonar-pro`
  - `sonar`

## [2.5.0] - 2025-07-04
### Added
- Image search capability
- Enhanced image processing and search functionality

## [2.0.0] - 2025-07-03
### Added
- Initial release
- 1min.ai API integration support
- Image generation functionality
- Cloudflare Workers deployment support
- Basic middleware and handler architecture
- Token validation and management features

### Changed
- Updated API response handling logic to use `temporaryUrl` field instead of `images` array

### Technical
- Established TypeScript project structure
- Configured Wrangler deployment environment
- Implemented modular architecture (handlers, services, middleware, utils)
