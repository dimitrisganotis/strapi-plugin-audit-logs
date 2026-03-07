# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **German Translation**: Added `de` translations for the plugin admin UI
- **Localized Admin UI**: Extended translation coverage across the audit logs page, modal, filters, pagination, and notifications
- **Configurable Table Columns**: Added `adminPanel.indexTableColumns` to configure which audit log table columns are shown
- **Direct Entry Links**: Added an optional `entry` table column that links matching `entry.*` logs to the Content Manager edit view

### Changed

- **User Display Priority**: Audit log user labels now prefer first and last name before username or email
- **Locale-Aware Dates**: Audit log timestamps now use the browser locale instead of a fixed `en-GB` format

### Fixed

- **Plugin Config Structure**: Moved admin panel settings into the documented plugin config object and added validation for unsupported or duplicate columns
- **Admin Config Route Permissions**: Restricted `/admin/audit-logs/config` to authenticated admins with audit log read access
- **Admin UI Stability**: Added safe column fallbacks while admin config loads and removed dead/debug code from the PR implementation
- **Action Labels**: Fixed the `admin.logout` translation key and corrected action badge variants for update, delete, and logout events

## [2.0.3] - 2025-06-11

### 🐛 Fixed

- **Content Manager Visibility**: Hidden audit logs from Content Manager interface
  - Set `visible: false` for audit log content type in content-manager
  - Audit logs should only be accessed through the dedicated plugin interface

## [2.0.2] - 2025-06-10

### 🐛 Fixed

- **Translation Loading Error**: Fixed "Module not found: ./translations/fr.json" error
  - Plugin no longer crashes when Strapi is set to French or other unsupported locales
  - Implemented proper fallback system where non-English locales fall back to English translations
  - Future-ready for additional language support with robust error handling

## [2.0.1] - 2025-06-10

### 🐛 Fixed

- **Peer Dependencies**: Relaxed version constraints for better compatibility
  - Changed `@strapi/design-system` from exact `2.0.0-rc.25` to flexible `^2.0.0-rc.0`
  - Changed `@strapi/icons` from exact `2.0.0-rc.25` to flexible `^2.0.0-rc.0`
  - Resolves npm install conflicts with different Strapi v5 release candidates

## [2.0.0] - 2025-06-10

### 🚀 Added

- **Strapi v5 Support**: Full compatibility with Strapi v5
- **Advanced Pagination**: Page size selector (10, 25, 50, 100) with smart navigation including ellipsis and quick page jumps
- **Enhanced Event Tracking**: Added support for media update events, role management events, and authentication failure tracking
- **Robust Cleanup System**: Both manual and automatic cleanup with `logAge` and `logCount` strategies
- **Better Error Handling**: Improved middleware error handling for authentication failures and edge cases
- **Document Service Integration**: Full integration with Strapi v5 Document Service API
- **Dual Middleware Approach**: Document Service middleware for content operations + HTTP middleware for admin panel operations
- **Permission System**: Role-based access control with super admin cleanup privileges
- **Sensitive Data Redaction**: Configurable field redaction for security compliance
- **Rich Admin Interface**: Modern UI with Design System v2, filtering, search, and detailed log views
- **IP Address & User Agent Tracking**: Enhanced security auditing capabilities

### 🔧 Changed

- **BREAKING**: Migrated from Entity Service API to Document Service API
- **BREAKING**: Updated from `@strapi/helper-plugin` to Strapi v5 admin APIs and Design System v2
- **BREAKING**: Upgraded React Router from v5 to v6
- **BREAKING**: Updated database schema to use `documentId` for Strapi v5 compatibility
- **BREAKING**: Removed support for Strapi v4
- **Improved UI/UX**: Modal height optimization for MacBook screens with `maxHeight: "85vh"`
- **Enhanced Middleware**: Better HTTP method detection for media operations (POST for updates, bulk operations)
- **Better Config Structure**: Improved plugin configuration with clearer deletion settings
- **Optimized Database Queries**: Use of Document Service API with proper filtering and pagination
- **Enhanced Logging**: More comprehensive event data capture including HTTP context

### 🗑️ Removed

- **BREAKING**: Removed `@strapi/helper-plugin` dependency
- **BREAKING**: Removed support for Strapi v4
- **BREAKING**: Removed content-type events tracking (deemed unnecessary and confusing)
- **BREAKING**: Removed permission events tracking (unused feature)
- **BREAKING**: Removed component events tracking (unused feature)

### 🐛 Fixed

- **Modal Display Issues**: Fixed modal height being too large
- **Event Detection**: Corrected HTTP method assumptions for media operations
- **Login Failure Tracking**: Added proper error handling for authentication failures that throw exceptions
- **Permission Checks**: Fixed sidebar visibility and access control using correct Strapi v5 APIs
- **User Data Handling**: Resolved useAuth hook issues by implementing direct API calls
- **Cleanup Functionality**: Fixed config structure mismatch and zero-value handling
- **Database Queries**: Improved `findOne` method with multiple ID lookup strategies
- **Route Structure**: Fixed routes export format for Strapi v5 compatibility

### 📚 Migration Guide

To upgrade from v1.x to v2.0.0:

1. **Ensure Strapi v5**: This version only supports Strapi v5. Upgrade your Strapi installation first.
2. **Update Plugin**: Install v2.0.0: `npm install strapi-plugin-audit-logs@^2.0.0`
3. **Review Configuration**: Update your `config/plugins.js`:
   - Remove `content-type.*` events from tracking if present
   - Review deletion configuration structure
   - Add new event types if desired (`media.update`, `role.*`, `admin.auth.failure`)
4. **Restart Application**: Restart Strapi to apply changes
5. **Set Permissions**: Configure user permissions in admin panel
6. **Data Migration**: Existing audit logs will continue to work - no data migration required

### ⚠️ Breaking Changes

**Plugin Compatibility**:

- This version only supports Strapi v5
- If you're still on Strapi v4, continue using v1.x: `npm install strapi-plugin-audit-logs@^1.0.0`

**Admin Panel**:

- Components migrated to Design System v2
- React Router v6 navigation patterns
- New permission structure

**Event Tracking**:

- Content-type events removed (`content-type.create`, `content-type.update`, `content-type.delete`)
- Permission events removed
- Component events removed

**Configuration**:

- Routes must export arrays instead of objects
- Cleanup configuration uses `deletion.frequency` and `deletion.options`

**Database**:

- Uses `documentId` as primary identifier (Strapi v5 standard)
- Document Service API calls replace Entity Service API

## [1.0.1] - 2025-06-09

### 🐛 Fixed

- Updated LICENSE copyright year to 2025

## [1.0.0] - 2025-06-09

### 🚀 Added

- Initial release with comprehensive audit logging
- Support for tracking all CRUD operations
- Admin interface for viewing audit logs
- Automatic cleanup functionality
- Configurable event tracking
- Sensitive data redaction
- IP address and user agent tracking
- Strapi v4 compatibility

### Security

- Automatic redaction of sensitive fields (passwords, tokens, etc.)
- Permission-based access to audit logs
- Secure logging of user activities without exposing sensitive data
