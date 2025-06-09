module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const startTime = Date.now();

    try {
      await next();
    } finally {
      // Only log after the response is complete
      setImmediate(async () => {
        try {
          const auditLogService = strapi.plugin("audit-logs").service("log");
          await auditLogService.logHttpRequest(ctx);
        } catch (error) {
          strapi.log.error("Failed to log HTTP request:", error);
        }
      });
    }
  };
};
