# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Strapi Audit Logs Plugin
- Comprehensive audit logging for Strapi v4
- Track content operations (create, update, delete, publish, unpublish)
- Track media operations (upload, delete, folder management)
- Track user management operations
- Track authentication events
- Rich admin interface with filtering and search
- Automatic log cleanup with configurable retention
- Manual cleanup functionality for super administrators
- Configurable sensitive data redaction
- Endpoint exclusion configuration
- Event tracking configuration
- IP address and user agent logging
- Detailed payload logging with JSON format
- Permission-based access control
- Support for PostgreSQL, MySQL/MariaDB and SQLite
- Node.js 18.x and 20.x compatibility
- Comprehensive documentation and examples

### Security
- Automatic redaction of sensitive fields (passwords, tokens, etc.)
- Permission-based access to audit logs
- Secure logging of user activities without exposing sensitive data

## [Unreleased]

### Planned
- Export functionality for audit logs
- Email notifications for critical events
- Strapi v5 support
