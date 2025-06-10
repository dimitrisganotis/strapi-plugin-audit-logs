module.exports = ({ strapi }) => {
  const pluginConfig =
    strapi.config.get("plugin::audit-logs") ||
    strapi.plugin("audit-logs").config;

  if (!pluginConfig?.enabled) {
    return;
  }

  const auditLogService = strapi.plugin("audit-logs").service("log");

  // Setup event listeners for entity operations
  auditLogService.initializeEventListeners();

  // Setup cleanup job
  auditLogService.setupCleanupJob();

  strapi.log.info("Audit logs plugin initialized");
};
