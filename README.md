# Strapi Audit Logs Plugin

A comprehensive audit logging plugin for **Strapi v5** that tracks all user interactions and system events with a clean admin interface and automatic cleanup.

> ⚠️ **Version Compatibility**
> - **v2.x**: Supports Strapi v5 only
> - **v1.x**: Supports Strapi v4 only
>
> If you're using Strapi v4, please install v1.x: `npm install strapi-plugin-audit-logs@^1.0.0`

## ✨ Features

- 🔍 **Comprehensive Logging**: Track content operations, media uploads, user management, and authentication events
- 🎯 **Smart Event Tracking**: Automatically logs content creation, updates, deletions, publishing, and more
- 🔒 **Data Security**: Configurable sensitive data redaction
- 🗂️ **Rich Admin UI**: Beautiful interface with filtering, search, pagination, and detailed log views
- 🧹 **Automatic Cleanup**: Configurable log retention with manual cleanup option
- 📊 **Detailed Logging**: Captures user info, IP addresses, HTTP context, and operation details
- 🔐 **Role-Based Permissions**: Granular access control with super admin cleanup controls

## 🚀 Installation

### Using NPM

```bash
npm install strapi-plugin-audit-logs@^2.0.0
```

### Using Yarn

```bash
yarn add strapi-plugin-audit-logs@^2.0.0
```

## ⚙️ Configuration

After installation, configure the plugin in your `config/plugins.js` (or `config/plugins.ts` for TypeScript):

```javascript
module.exports = {
  "audit-logs": {
    enabled: true,
    config: {
      enabled: true,
      deletion: {
        enabled: true,
        frequency: "logAge", // 'logAge' or 'logCount'
        options: {
          value: 90, // Keep logs for 90 days
          interval: "day", // 'day', 'week', 'month', 'year'
        },
      },
      excludeContentTypes: [
        "plugin::any-custom-type.any-custom-type",
      ],
      excludeEndpoints: [
        "/admin/renew-token",
        "/api/upload",
        "/api/any-custom-type/any-custom-route",
      ],
      redactedValues: [
        "password",
        "token",
        "jwt",
        "authorization",
        "secret",
        "key",
        "private",
      ],
      events: {
        track: [
          "entry.create",
          "entry.update",
          "entry.delete",
          "entry.publish",
          "entry.unpublish",
          "media.create",
          "media.update",
          "media.delete",
          "media-folder.create",
          "media-folder.update",
          "media-folder.delete",
          "user.create",
          "user.update",
          "user.delete",
          "role.create",
          "role.update",
          "role.delete",
          "admin.auth.success",
          "admin.auth.failure",
          "admin.logout",
        ],
      },
    },
  },
};
```

### TypeScript Configuration

For TypeScript projects, create or update `config/plugins.ts`:

```typescript
export default {
  "audit-logs": {
    enabled: true,
    config: {
      // ... same configuration as above
    },
  },
};
```

## 🔧 Setup

1. **Install the plugin** using npm or yarn (see installation section above)

2. **Configure the plugin** in `config/plugins.js` or `config/plugins.ts`

3. **Restart your Strapi application**:
   ```bash
   npm run develop
   # or
   yarn develop
   ```

4. **Set up permissions** in the Strapi admin panel:
   - Go to Settings → Roles
   - Edit the roles that should have access to audit logs
   - Enable "View Audit Logs" permission for the Audit Logs plugin

## 📋 Configuration Options

### Basic Configuration

#### `enabled`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable/disable the entire plugin

#### `deletion`
Configure automatic log cleanup:
- **enabled**: `boolean` - Enable automatic cleanup (runs daily at midnight)
- **frequency**: `'logAge' | 'logCount'` - Cleanup strategy
- **options**:
  - For `logAge`: `{ value: 90, interval: 'day' }` (delete logs older than 90 days)
  - For `logCount`: `{ value: 1000 }` (keep only latest 1000 logs)

#### `excludeEndpoints`
Array of API endpoints to exclude from logging. Supports:
- **Exact matches**: `/api/my-custom-endpoint`
- **Prefix matches**: `/admin/renew-token` (matches `/admin/renew-token/anything`)
- **Wildcards**: `/api/upload/*` (matches any endpoint starting with `/api/upload/`)

#### `excludeContentTypes`
Array of content type UIDs to exclude from logging (e.g., `["api::private-content.private-content"]`)

#### `redactedValues`
Array of field names to redact in logged data for security purposes.

#### `events`
Configure automatic event tracking:
- **track**: `string[]` - Array of events to log automatically

## 📊 Tracked Events

The plugin automatically tracks these system events:

### Content Events
- `entry.create` - Content entry created
- `entry.update` - Content entry updated
- `entry.delete` - Content entry deleted
- `entry.publish` - Content entry published
- `entry.unpublish` - Content entry unpublished

### Media Events
- `media.create` - Media file uploaded
- `media.update` - Media file updated
- `media.delete` - Media file deleted
- `media-folder.create` - Media folder created
- `media-folder.update` - Media folder updated
- `media-folder.delete` - Media folder deleted

### User Management Events
- `user.create` - User account created
- `user.update` - User account updated
- `user.delete` - User account deleted

### Role Management Events
- `role.create` - Role created
- `role.update` - Role updated
- `role.delete` - Role deleted

### Authentication Events
- `admin.auth.success` - Successful admin login
- `admin.auth.failure` - Failed admin login attempt
- `admin.logout` - Admin logout

## 🎯 Usage

### Accessing Audit Logs

1. Navigate to the Strapi admin panel
2. Look for "Audit Logs" in the main navigation menu
3. Click to view the audit logs interface

### Viewing Logs

The audit logs interface provides:
- **Table View**: See all logs with action, date, user, method, status, and IP address
- **Action Filter**: Dropdown to filter by specific action types
- **User Search**: Text input to search by username or email
- **Advanced Pagination**: Page size selector (10, 25, 50, 100) with smart navigation
- **Details Modal**: Click "View" to see full log details including JSON payload data

### Log Details

Each log entry contains:
- **Action**: The type of action performed (with color-coded badges)
- **Date**: When the action occurred
- **User**: Who performed the action (username/email)
- **Method**: HTTP method used (GET, POST, PUT, DELETE)
- **Status Code**: Response status code (with color coding)
- **IP Address**: Client IP address
- **User Agent**: Client browser/application

- **Payload Data**: Full operation details in JSON format

### Manual Cleanup

Super administrators can manually trigger log cleanup by clicking the "Cleanup Old Logs" button in the interface.

## 🔐 Permissions

The plugin uses a role-based permission system:

- **View Audit Logs**: Basic access to view the audit logs page and browse logs
- **View Details**: Access to detailed log information (available to all users with read access)
- **Cleanup**: Manual cleanup functionality (super administrators only)

To grant access:
1. Go to Settings → Roles
2. Select the role to modify
3. Under "Plugins" → "Audit Logs", enable "View Audit Logs"
4. Cleanup functionality is automatically available to super administrators

## 🔌 API Endpoints

The plugin provides these API endpoints (admin authentication required):

- `GET /admin/audit-logs` - List audit logs with filtering and pagination
- `GET /admin/audit-logs/:id` - Get specific log details
- `GET /admin/audit-logs/count` - Count total logs
- `POST /admin/audit-logs/cleanup` - Trigger manual cleanup (super admin only)

## 🗄️ Database Schema

The plugin creates an `audit_logs` table with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Primary Key | Unique identifier |
| `documentId` | String | Document identifier (Strapi v5) |
| `action` | String | Action performed (e.g., entry.create, media.delete) |
| `date` | DateTime | Timestamp of the action |
| `payload` | JSON | Operation details and context |
| `userId` | Integer | User ID (if authenticated) |
| `userDisplayName` | String | User display name |
| `userEmail` | String | User email |
| `endpoint` | String | API endpoint accessed |
| `method` | String | HTTP method (GET, POST, PUT, DELETE) |
| `statusCode` | Integer | HTTP response status code |
| `ipAddress` | String | Client IP address |
| `userAgent` | Text | Client user agent string |


## 🔒 Security Considerations

- Sensitive data is automatically redacted based on configuration
- Logs are only accessible to users with proper permissions
- IP addresses and user agents are logged for security auditing
- Cleanup functionality restricted to super administrators
- Consider log retention policies for compliance requirements

## 🛠️ Troubleshooting

### Plugin Not Appearing
1. Ensure the plugin is enabled in `config/plugins.js`
2. Restart Strapi after configuration changes
3. Check that your user role has the "View Audit Logs" permission

### No Logs Being Created
1. Verify `enabled: true` in plugin configuration
2. Check that the events you want to track are in the `events.track` array
3. Restart Strapi after configuration changes
4. Look for error messages in Strapi logs

### Performance Issues
1. Reduce the number of tracked events in configuration
2. Decrease log retention period for faster cleanup
3. Use `logCount` cleanup strategy for high-traffic sites

## 🔄 Compatibility

- **Strapi**: 5.x
- **Node.js**: 18.x, 20.x, 22.x
- **Database**: PostgreSQL, MySQL/MariaDB, SQLite
- **Operating System**: Windows, macOS, Linux

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This plugin was inspired by Strapi Enterprise Edition's audit logs feature and the community plugin by [Marje3PSUT](https://github.com/Marje3PSUT/strapi-plugin-audit-log-marje3).

## 📞 Support

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Search existing [GitHub issues](https://github.com/dimitrisganotis/strapi-plugin-audit-logs/issues)
3. Create a new issue if needed
