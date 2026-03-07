const {
  DEFAULT_INDEX_TABLE_COLUMNS,
  ALLOWED_INDEX_TABLE_COLUMNS,
} = require("./admin-panel");

module.exports = {
  default: {
    enabled: true,
    deletion: {
      enabled: true,
      frequency: "logAge", // 'logAge' or 'logCount'
      options: {
        value: 90,
        interval: "day", // 'day', 'week', 'month', 'year'
      },
    },
    excludeEndpoints: ["/admin/renew-token", "/api/upload"],
    excludeContentTypes: [],
    redactedValues: [
      "password",
      "token",
      "jwt",
      "authorization",
      "cookie",
      "session",
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
        "admin.auth.success",
        "admin.auth.failure",
        "admin.logout",
        "role.create",
        "role.update",
        "role.delete",
      ],
    },
    adminPanel: {
      indexTableColumns: DEFAULT_INDEX_TABLE_COLUMNS,
    },
  },
  validator(config) {
    const columns = config?.adminPanel?.indexTableColumns;

    if (!Array.isArray(columns)) {
      throw new Error(
        "adminPanel.indexTableColumns must be an array of supported column names",
      );
    }

    const duplicates = columns.filter(
      (column, index) => columns.indexOf(column) !== index,
    );

    if (duplicates.length > 0) {
      throw new Error(
        `adminPanel.indexTableColumns contains duplicate values: ${[
          ...new Set(duplicates),
        ].join(", ")}`,
      );
    }

    const invalidColumns = columns.filter(
      (column) => !ALLOWED_INDEX_TABLE_COLUMNS.has(column),
    );

    if (invalidColumns.length > 0) {
      throw new Error(
        `adminPanel.indexTableColumns contains unsupported values: ${[
          ...new Set(invalidColumns),
        ].join(", ")}`,
      );
    }
  },
};
