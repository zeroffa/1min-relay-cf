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

## [2.10.0] - 2025-07-24
### Added
- New OpenAI models support:
  - `o3-mini`
  - `o4-mini`
  - `gpt-4.5-preview`
  - `gpt-4.1`
  - `gpt-4.1-nano`
  - `gpt-4.1-mini`
- New Claude models support:
  - `claude-3-5-haiku-20241022`
  - `claude-3-7-sonnet-20250219`
- New Gemini models support:
  - `gemini-2.0-flash`
  - `gemini-2.0-flash-lite`
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`
  - `gemini-2.5-flash-preview-05-20`
  - `gemini-2.5-pro-preview-05-06`
- New Meta models support:
  - `meta/meta-llama-3.1-405b-instruct`
  - `meta/llama-4-maverick-instruct`
  - `meta/llama-4-scout-instruct`
- New DeepSeek models support:
  - `deepseek-chat`
  - `deepseek-reasoner`
- New Perplexity Sonar models support:
  - `sonar-reasoning-pro`
  - `sonar-reasoning`
  - `sonar-pro`
  - `sonar`
- New Flux model support:
  - `flux-1.1-pro`
- New Midjourney model support:
  - `midjourney_6_1`

## [2.9.0] - 2025-01-27
### Added
- **OpenAI Responses API** support (`/v1/responses`)
  - Structured output support with JSON objects and JSON schema validation
  - Reasoning effort control (low, medium, high)
  - Enhanced prompting for structured responses
  - Vision support with image inputs (same as Chat Completions)
  - Rate limiting and API key validation
- New `ResponseRequest` interface for Responses API
- `ResponseHandler` class for handling structured outputs and reasoning requests
- Enhanced system prompting based on response format and reasoning effort
- JSON parsing and validation for structured responses

### Changed
- Updated root endpoint to display all available API endpoints
- Enhanced API documentation with Responses API examples
- Improved error handling for structured response parsing

### Technical
- Added `src/handlers/responses.ts` - Main Responses API handler
- Updated `src/constants/config.ts` - Added RESPONSES endpoint constant
- Updated `src/types/requests.ts` - Added ResponseRequest interface
- Updated `src/index.ts` - Added routing and rate limiting for responses endpoint
- Updated `src/handlers/index.ts` - Exported ResponseHandler
- Created comprehensive testing documentation for both APIs

## [2.8.0] - 2025-01-27
### Changed
- Replaced custom UUID generation with native Cloudflare Workers Web Crypto API
- Removed `generateUUID()` wrapper function in favor of direct `crypto.randomUUID()` usage
- Simplified codebase by eliminating unnecessary UUID utility file

### Technical
- Deleted `src/utils/uuid.ts` file
- Updated all UUID generation calls to use `crypto.randomUUID()` directly
- Improved performance and security with native cryptographic UUID generation

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
