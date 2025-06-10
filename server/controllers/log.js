module.exports = ({ strapi }) => ({
  async find(ctx) {
    try {
      const { query } = ctx.request;

      // Parse and validate pagination parameters
      const page = Math.max(parseInt(query.page) || 1, 1);
      const pageSize = Math.min(
        Math.max(parseInt(query.pageSize) || 25, 1),
        100
      );
      const start = (page - 1) * pageSize;
      const limit = pageSize;

      // Parse and validate sorting - always prioritize date
      let sort = { date: "desc", id: "desc" }; // Secondary sort by ID for consistency
      if (query.sort) {
        const [field, order] = query.sort.split(":");
        const allowedFields = [
          "action",
          "date",
          "method",
          "statusCode",
          "userDisplayName",
          "endpoint",
          "ipAddress",
        ];
        const allowedOrders = ["asc", "desc"];

        if (allowedFields.includes(field) && allowedOrders.includes(order)) {
          // Always include date as primary sort, then the requested field
          if (field === "date") {
            sort = { date: order, id: "desc" };
          } else {
            sort = { date: "desc", [field]: order, id: "desc" };
          }
        }
      }

      // Parse and validate filters using Strapi v5 Document Service API syntax
      const filters = {};

      // Handle action filter (the frontend sends 'action' parameter)
      if (query.action && typeof query.action === "string") {
        filters.action = { $eq: query.action.trim() };
      }

      if (query.user && typeof query.user === "string") {
        filters.userDisplayName = { $containsi: query.user.trim() };
      }

      if (query.dateFrom) {
        const dateFrom = new Date(query.dateFrom);
        if (!isNaN(dateFrom.getTime())) {
          filters.date = filters.date || {};
          filters.date.$gte = dateFrom.toISOString();
        }
      }

      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        if (!isNaN(dateTo.getTime())) {
          filters.date = filters.date || {};
          filters.date.$lte = dateTo.toISOString();
        }
      }

      const auditLogService = strapi.plugin("audit-logs").service("log");

      // Debug log to see what filters are being applied
      strapi.log.debug("Audit logs query filters:", {
        filters,
        sort,
        start,
        limit,
        originalQuery: query,
      });

      // Check if the service and content type exist
      if (!auditLogService) {
        strapi.log.error("Audit log service not found");
        ctx.body = {
          data: [],
          meta: { pagination: { page, pageSize, pageCount: 0, total: 0 } },
        };
        return;
      }

      let logs = [];
      let total = 0;

      try {
        [logs, total] = await Promise.all([
          auditLogService.findMany({
            filters,
            sort,
            start,
            limit,
          }),
          auditLogService.count({ filters }),
        ]);
      } catch (serviceError) {
        strapi.log.error("Service call error:", serviceError);
        // If content type doesn't exist yet or no data, return empty result
        logs = [];
        total = 0;
      }

      const pagination = {
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
        total,
      };

      ctx.body = {
        data: logs,
        meta: { pagination },
      };
    } catch (error) {
      strapi.log.error("Failed to fetch audit logs:", error);
      strapi.log.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      ctx.throw(500, "Failed to fetch audit logs");
    }
  },

  async findOne(ctx) {
    try {
      const { id } = ctx.params;

      if (!id) {
        ctx.throw(400, "Invalid log ID");
      }

      const auditLogService = strapi.plugin("audit-logs").service("log");
      const log = await auditLogService.findOne(id);

      if (!log) {
        ctx.throw(404, "Audit log not found");
      }

      ctx.body = { data: log };
    } catch (error) {
      if (error.status) {
        throw error;
      }
      strapi.log.error("Failed to fetch audit log:", error);
      ctx.throw(500, "Failed to fetch audit log");
    }
  },

  async count(ctx) {
    try {
      const { query } = ctx.request;

      // Reuse the same filter parsing logic from find method
      const filters = {};

      // Handle action filter (exact match, same as find method)
      if (query.action && typeof query.action === "string") {
        filters.action = { $eq: query.action.trim() };
      }

      if (query.user && typeof query.user === "string") {
        filters.userDisplayName = { $containsi: query.user.trim() };
      }

      if (query.method && typeof query.method === "string") {
        const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        if (allowedMethods.includes(query.method.toUpperCase())) {
          filters.method = { $eq: query.method.toUpperCase() };
        }
      }

      if (query.dateFrom) {
        const dateFrom = new Date(query.dateFrom);
        if (!isNaN(dateFrom.getTime())) {
          filters.date = filters.date || {};
          filters.date.$gte = dateFrom.toISOString();
        }
      }

      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        if (!isNaN(dateTo.getTime())) {
          filters.date = filters.date || {};
          filters.date.$lte = dateTo.toISOString();
        }
      }

      const auditLogService = strapi.plugin("audit-logs").service("log");
      const count = await auditLogService.count({ filters });

      ctx.body = { data: count };
    } catch (error) {
      strapi.log.error("Failed to count audit logs:", error);
      ctx.throw(500, "Failed to count audit logs");
    }
  },

  async cleanup(ctx) {
    try {
      // Check if user is super admin
      const { user } = ctx.state;

      if (!user || !user.roles || !Array.isArray(user.roles)) {
        ctx.throw(403, "Access denied: Super admin role required");
      }

      const isSuperAdmin = user.roles.some(role =>
        role.code === "strapi-super-admin" || role.name === "Super Admin"
      );

      if (!isSuperAdmin) {
        ctx.throw(403, "Access denied: Super admin role required");
      }

      const auditLogService = strapi.plugin("audit-logs").service("log");
      const result = await auditLogService.cleanupOldLogs();

      ctx.body = {
        message: "Cleanup completed successfully",
        deleted: result.count || 0,
      };
    } catch (error) {
      strapi.log.error("Failed to cleanup audit logs:", error);
      ctx.throw(500, "Failed to cleanup audit logs");
    }
  },
});
