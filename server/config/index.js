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
  },
  validator: () => {},
};
