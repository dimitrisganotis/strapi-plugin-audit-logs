"use strict";

const { scheduleJob } = require("node-schedule");

module.exports = ({ strapi }) => ({
  async createLog(logData) {
    const config =
      strapi.config.get("plugin.audit-logs") ||
      strapi.plugin("audit-logs").config;

    if (!config?.enabled) {
      return null;
    }

    try {
      // Redact sensitive values
      const redactedData = this.redactSensitiveData(
        logData,
        config.redactedValues
      );

      const log = await strapi.entityService.create("plugin::audit-logs.log", {
        data: {
          ...redactedData,
          date: new Date(),
        },
      });

      return log;
    } catch (error) {
      strapi.log.error("Failed to create audit log:", error);
      return null;
    }
  },

  async findMany(params = {}) {
    try {
      const { filters, sort, start, limit, ...otherParams } = params;

      const logs = await strapi.entityService.findMany(
        "plugin::audit-logs.log",
        {
          filters,
          sort: sort || { date: "desc" },
          start,
          limit,
          populate: {
            user: {
              select: ["id", "firstname", "lastname", "email", "username"],
            },
          },
          ...otherParams,
        }
      );

      return logs;
    } catch (error) {
      strapi.log.error("Failed to fetch audit logs:", error);
      throw error;
    }
  },

  async findOne(id) {
    try {
      const log = await strapi.entityService.findOne(
        "plugin::audit-logs.log",
        id,
        {
          populate: {
            user: {
              select: ["id", "firstname", "lastname", "email", "username"],
            },
          },
        }
      );

      return log;
    } catch (error) {
      strapi.log.error("Failed to fetch audit log:", error);
      throw error;
    }
  },

  async count(params = {}) {
    try {
      const { filters } = params;
      return await strapi.entityService.count("plugin::audit-logs.log", {
        filters,
      });
    } catch (error) {
      strapi.log.error("Failed to count audit logs:", error);
      throw error;
    }
  },

  redactSensitiveData(data, redactedValues = []) {
    if (!data || typeof data !== "object") {
      return data;
    }

    const redacted = { ...data };

    // Redact nested objects
    ["requestBody", "responseBody", "payload"].forEach((key) => {
      if (redacted[key]) {
        redacted[key] = this.redactObject(redacted[key], redactedValues);
      }
    });

    return redacted;
  },

  redactObject(obj, redactedValues = []) {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

    Object.keys(redacted).forEach((key) => {
      const lowerKey = key.toLowerCase();
      const shouldRedact = redactedValues.some((value) =>
        lowerKey.includes(value.toLowerCase())
      );

      if (shouldRedact) {
        redacted[key] = "[REDACTED]";
      } else if (typeof redacted[key] === "object" && redacted[key] !== null) {
        redacted[key] = this.redactObject(redacted[key], redactedValues);
      }
    });

    return redacted;
  },

  async logEvent(eventName, payload = {}, user = null) {
    const config =
      strapi.config.get("plugin.audit-logs") ||
      strapi.plugin("audit-logs").config;

    if (!config?.enabled) {
      return;
    }

    // CRITICAL: Prevent recursion - never log audit log operations
    if (
      eventName.includes("plugin::audit-logs.log") ||
      payload?.uid === "plugin::audit-logs.log" ||
      payload?.model === "log"
    ) {
      return;
    }

    // Check if endpoint should be excluded
    if (payload.endpoint && config.excludeEndpoints) {
      const shouldExclude = config.excludeEndpoints.some((excludedEndpoint) => {
        // Support both exact matches and pattern matching
        if (excludedEndpoint.includes("*")) {
          // Convert wildcard to regex
          const regex = new RegExp(excludedEndpoint.replace(/\*/g, ".*"));
          return regex.test(payload.endpoint);
        }
        // Exact match or starts with match
        return (
          payload.endpoint === excludedEndpoint ||
          payload.endpoint.startsWith(excludedEndpoint)
        );
      });

      if (shouldExclude) {
        return; // Skip logging for excluded endpoints
      }
    }

    if (!config.events.track.includes(eventName)) {
      return;
    }

    let userId = null;
    let userDisplayName = null;
    let userEmail = null;

    if (user) {
      userId = user.id;
      userEmail = user.email;
      userDisplayName =
        user.username ||
        (user.firstname && user.lastname
          ? `${user.firstname} ${user.lastname}`
          : user.email);
    }

    const logData = {
      action: eventName,
      payload,
      userId,
      userDisplayName,
      userEmail,
      user: userId ? userId : null,
      // Extract HTTP context from payload if available
      endpoint: payload.endpoint || null,
      method: payload.method || null,
      statusCode: payload.statusCode || null,
      ipAddress: payload.ipAddress || null,
      userAgent: payload.userAgent || null,
    };

    await this.createLog(logData);
  },

  getClientIP(ctx) {
    const forwarded = ctx.request.headers["x-forwarded-for"];
    const realIP = ctx.request.headers["x-real-ip"];

    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    if (realIP) {
      return realIP;
    }
    return ctx.request.ip || ctx.request.socket.remoteAddress;
  },

  async cleanupOldLogs() {
    const config =
      strapi.config.get("plugin.audit-logs") ||
      strapi.plugin("audit-logs").config;

    if (!config?.deletion?.enabled) {
      return;
    }

    try {
      if (config.deletion.frequency === "logAge") {
        await this.cleanupByAge(config.deletion.options);
      } else if (config.deletion.frequency === "logCount") {
        await this.cleanupByCount(config.deletion.options);
      }
    } catch (error) {
      strapi.log.error("Failed to cleanup old audit logs:", error);
    }
  },

  async cleanupByAge(options) {
    const { value, interval } = options;
    let cutoffDate = new Date();

    switch (interval) {
      case "day":
        cutoffDate.setDate(cutoffDate.getDate() - value);
        break;
      case "week":
        cutoffDate.setDate(cutoffDate.getDate() - value * 7);
        break;
      case "month":
        cutoffDate.setMonth(cutoffDate.getMonth() - value);
        break;
      case "year":
        cutoffDate.setFullYear(cutoffDate.getFullYear() - value);
        break;
      default:
        strapi.log.warn("Invalid cleanup interval:", interval);
        return;
    }

    try {
      const logsToDelete = await strapi.entityService.findMany(
        "plugin::audit-logs.log",
        {
          filters: {
            date: {
              $lt: cutoffDate.toISOString(),
            },
          },
          fields: ["id"],
        }
      );

      // Use batch deletion for better performance
      if (logsToDelete.length > 0) {
        await Promise.all(
          logsToDelete.map((log) =>
            strapi.entityService.delete("plugin::audit-logs.log", log.id)
          )
        );

        strapi.log.info(`Cleaned up ${logsToDelete.length} old audit logs`);
      }
    } catch (error) {
      strapi.log.error("Failed to cleanup logs by age:", error);
    }
  },

  async cleanupByCount(options) {
    const { value } = options;

    try {
      const totalLogs = await this.count();

      if (totalLogs <= value) {
        return;
      }

      const logsToDelete = totalLogs - value;
      const oldestLogs = await strapi.entityService.findMany(
        "plugin::audit-logs.log",
        {
          sort: { date: "asc" },
          limit: logsToDelete,
          fields: ["id"],
        }
      );

      // Use batch deletion for better performance
      if (oldestLogs.length > 0) {
        await Promise.all(
          oldestLogs.map((log) =>
            strapi.entityService.delete("plugin::audit-logs.log", log.id)
          )
        );

        strapi.log.info(
          `Cleaned up ${oldestLogs.length} old audit logs to maintain ${value} total logs`
        );
      }
    } catch (error) {
      strapi.log.error("Failed to cleanup logs by count:", error);
    }
  },

  setupCleanupJob() {
    const config =
      strapi.config.get("plugin.audit-logs") ||
      strapi.plugin("audit-logs").config;

    if (!config?.deletion?.enabled) {
      return;
    }

    // Run cleanup daily at midnight
    scheduleJob("0 0 * * *", () => {
      this.cleanupOldLogs();
    });

    strapi.log.info("Audit logs cleanup job scheduled");
  },

  setupEventListeners() {
    const config =
      strapi.config.get("plugin.audit-logs") ||
      strapi.plugin("audit-logs").config;

    if (!config?.enabled) {
      return;
    }

    // Store original methods
    const originalCreate = strapi.entityService.create;
    const originalUpdate = strapi.entityService.update;
    const originalDelete = strapi.entityService.delete;

    // Helper function to map UID to event type
    const getEventType = (uid, operation, ctx = null) => {
      // Check for publish/unpublish actions from endpoint
      if (ctx?.request?.url) {
        const url = ctx.request.url;
        if (url.includes("/actions/publish")) {
          return "entry.publish";
        }
        if (url.includes("/actions/unpublish")) {
          return "entry.unpublish";
        }
      }

      // Media/Upload files
      if (uid === "plugin::upload.file") {
        return `media.${operation}`;
      }

      // Media folders
      if (uid === "plugin::upload.folder") {
        return `media-folder.${operation}`;
      }

      // Admin users
      if (uid === "admin::user") {
        return `user.${operation}`;
      }

      // Admin roles
      if (uid === "admin::role") {
        return `role.${operation}`;
      }

      // Admin permissions
      if (uid === "admin::permission") {
        return `permission.${operation}`;
      }

      // Content types
      if (uid.startsWith("api::")) {
        return `entry.${operation}`;
      }

      // Components
      if (uid.includes("component")) {
        return `component.${operation}`;
      }

      // Content types (catch-all for custom content types)
      if (uid.includes("::")) {
        return `content-type.${operation}`;
      }

      // Default fallback
      return `entry.${operation}`;
    };

    // Helper function to create log entry
    const createLogEntry = async (operation, uid, result, id = null) => {
      if (uid === "plugin::audit-logs.log") {
        return;
      }

      // Check if content type should be excluded
      if (
        config.excludeContentTypes &&
        config.excludeContentTypes.includes(uid)
      ) {
        return; // Skip logging for excluded content types
      }

      const ctx = strapi.requestContext?.get?.();
      const user = ctx?.state?.user;

      // Map UID to correct event type (pass context for publish/unpublish detection)
      const eventType = getEventType(uid, operation, ctx);

      const logData = {
        uid,
        id: result?.id || id,
        data: result,
      };

      // Add HTTP context if available
      if (ctx) {
        logData.endpoint = ctx.request?.url;
        logData.method = ctx.request?.method;
        logData.statusCode = ctx.response?.status;
        logData.ipAddress = this.getClientIP(ctx);
        logData.userAgent = ctx.request?.headers?.["user-agent"];
      }

      try {
        await this.logEvent(eventType, logData, user);
      } catch (error) {
        strapi.log.error(`Failed to log entity ${operation}:`, error);
      }
    };

    // Override entity service create method
    strapi.entityService.create = async function (uid, params) {
      const result = await originalCreate.call(this, uid, params);

      setTimeout(() => createLogEntry("create", uid, result), 0);

      return result;
    };

    // Override entity service update method
    strapi.entityService.update = async function (uid, id, params) {
      const result = await originalUpdate.call(this, uid, id, params);

      setTimeout(() => createLogEntry("update", uid, result), 0);

      return result;
    };

    // Override entity service delete method
    strapi.entityService.delete = async function (uid, id, params) {
      const result = await originalDelete.call(this, uid, id, params);

      setTimeout(() => createLogEntry("delete", uid, result, id), 0);

      return result;
    };

    // Add HTTP middleware to catch folder deletion requests and admin operations
    strapi.server.use(async (ctx, next) => {
      const url = ctx.request.url;
      const method = ctx.request.method;

      // Check if this is a folder deletion request
      if (method === "DELETE" && url.includes("/upload/folders/")) {
        // Extract folder ID from URL
        const folderIdMatch = url.match(/\/upload\/folders\/(\d+)/);
        const folderId = folderIdMatch ? folderIdMatch[1] : null;

        if (folderId) {
          // Try to get folder details before deletion
          try {
            const folder = await strapi.entityService.findOne(
              "plugin::upload.folder",
              folderId
            );

            // Store for after deletion
            ctx.state.folderToDelete = { id: folderId, data: folder };
          } catch (error) {
            strapi.log.warn(
              "Could not fetch folder details before deletion:",
              error
            );
          }
        }
      }

      // Check for admin login
      if (method === "POST" && url === "/admin/login") {
        ctx.state.loginStartTime = Date.now();
        ctx.state.loginEmail = ctx.request.body?.email;
      }

      // Check for admin logout
      if (method === "POST" && url === "/admin/logout") {
        ctx.state.isLogout = true;
      }

      // Check for admin user operations
      if (url.startsWith("/admin/users")) {
        if (method === "POST" && url === "/admin/users") {
          ctx.state.adminUserCreate = true;
        } else if (method === "PUT" && url.match(/\/admin\/users\/\d+/)) {
          ctx.state.adminUserUpdate = true;
        } else if (method === "PUT" && url === "/admin/users/me") {
          ctx.state.adminUserUpdate = true;
        } else if (method === "DELETE" && url.match(/\/admin\/users\/\d+/)) {
          ctx.state.adminUserDelete = true;
        } else if (method === "POST" && url.includes("/batch-delete")) {
          ctx.state.adminUserBatchDelete = true;
        }
      }

      // Check for admin role operations
      if (url.startsWith("/admin/roles")) {
        if (method === "POST" && url === "/admin/roles") {
          ctx.state.adminRoleCreate = true;
        } else if (method === "PUT" && url.match(/\/admin\/roles\/\d+$/)) {
          ctx.state.adminRoleUpdate = true;
        } else if (method === "DELETE" && url.match(/\/admin\/roles\/\d+/)) {
          ctx.state.adminRoleDelete = true;
        } else if (method === "POST" && url.includes("/batch-delete")) {
          ctx.state.adminRoleDelete = true;
        }
      }

      await next();

      // After the request, log operations if they were successful
      if (ctx.response.status >= 200 && ctx.response.status < 300) {
        // Log folder deletion
        if (
          method === "DELETE" &&
          url.includes("/upload/folders/") &&
          ctx.state.folderToDelete
        ) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const folderInfo = ctx.state.folderToDelete;

            const logData = {
              uid: "plugin::upload.folder",
              id: folderInfo.id,
              data: folderInfo.data,
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
            };

            try {
              await this.logEvent("media-folder.delete", logData, user);
            } catch (error) {
              strapi.log.error(
                "Failed to log folder deletion via HTTP middleware:",
                error
              );
            }
          }, 0);
        }

        // Log admin login
        if (ctx.state.loginStartTime) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              duration: Date.now() - ctx.state.loginStartTime,
              loginAttempt: {
                email: ctx.state.loginEmail,
                success: true,
              },
            };

            try {
              await this.logEvent("admin.auth.success", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin login:", error);
            }
          }, 0);
        }

        // Log admin logout
        if (ctx.state.isLogout) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
            };

            try {
              await this.logEvent("admin.logout", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin logout:", error);
            }
          }, 0);
        }

        // Log admin user operations
        if (ctx.state.adminUserCreate) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.request.body,
            };

            try {
              await this.logEvent("user.create", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin user creation:", error);
            }
          }, 0);
        }

        if (ctx.state.adminUserUpdate) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.request.body,
            };

            try {
              await this.logEvent("user.update", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin user update:", error);
            }
          }, 0);
        }

        if (ctx.state.adminUserDelete || ctx.state.adminUserBatchDelete) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.request.body,
            };

            try {
              await this.logEvent("user.delete", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin user deletion:", error);
            }
          }, 0);
        }

        // Log admin role operations
        if (ctx.state.adminRoleCreate) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.request.body,
            };

            try {
              await this.logEvent("role.create", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin role creation:", error);
            }
          }, 0);
        }

        if (ctx.state.adminRoleUpdate) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.request.body,
            };

            try {
              await this.logEvent("role.update", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin role update:", error);
            }
          }, 0);
        }

        if (ctx.state.adminRoleDelete) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.request.body,
            };

            try {
              await this.logEvent("role.delete", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log admin role deletion:", error);
            }
          }, 0);
        }
      }
    });

    // Hook into upload plugin for file uploads and media folders
    if (strapi.plugin("upload")) {
      try {
        const uploadService = strapi.plugin("upload").service("upload");
        const folderService = strapi.plugin("upload").service("folder");

        // File upload/delete hooks
        const originalUpload = uploadService.upload;
        const originalRemove = uploadService.remove;

        uploadService.upload = async function (params) {
          const result = await originalUpload.call(this, params);

          setTimeout(async () => {
            const ctx = strapi.requestContext?.get?.();
            const user = ctx?.state?.user;

            const logData = {
              uid: "plugin::upload.file",
              data: result,
            };

            if (ctx) {
              logData.endpoint = ctx.request?.url;
              logData.method = ctx.request?.method;
              logData.statusCode = ctx.response?.status;
              logData.ipAddress = strapi
                .plugin("audit-logs")
                .service("log")
                .getClientIP(ctx);
              logData.userAgent = ctx.request?.headers?.["user-agent"];
            }

            try {
              await strapi
                .plugin("audit-logs")
                .service("log")
                .logEvent("media.create", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log file upload:", error);
            }
          }, 0);

          return result;
        };

        uploadService.remove = async function (file) {
          const result = await originalRemove.call(this, file);

          setTimeout(async () => {
            const ctx = strapi.requestContext?.get?.();
            const user = ctx?.state?.user;

            const logData = {
              uid: "plugin::upload.file",
              id: file.id,
              data: file,
            };

            if (ctx) {
              logData.endpoint = ctx.request?.url;
              logData.method = ctx.request?.method;
              logData.statusCode = ctx.response?.status;
              logData.ipAddress = strapi
                .plugin("audit-logs")
                .service("log")
                .getClientIP(ctx);
              logData.userAgent = ctx.request?.headers?.["user-agent"];
            }

            try {
              await strapi
                .plugin("audit-logs")
                .service("log")
                .logEvent("media.delete", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log file removal:", error);
            }
          }, 0);

          return result;
        };

        // Media folder hooks - let's try different approaches
        if (folderService) {
          // Hook into the actual deleteByIds method
          if (folderService.deleteByIds) {
            const originalDeleteByIds = folderService.deleteByIds;

            folderService.deleteByIds = async function (ids) {
              const result = await originalDeleteByIds.call(this, ids);

              setTimeout(async () => {
                const ctx = strapi.requestContext?.get?.();
                const user = ctx?.state?.user;

                const logData = {
                  uid: "plugin::upload.folder",
                  id: Array.isArray(ids) ? ids[0] : ids,
                  data: { deletedFolderIds: ids },
                };

                if (ctx) {
                  logData.endpoint = ctx.request?.url;
                  logData.method = ctx.request?.method;
                  logData.statusCode = ctx.response?.status;
                  logData.ipAddress = strapi
                    .plugin("audit-logs")
                    .service("log")
                    .getClientIP(ctx);
                  logData.userAgent = ctx.request?.headers?.["user-agent"];
                }

                try {
                  await strapi
                    .plugin("audit-logs")
                    .service("log")
                    .logEvent("media-folder.delete", logData, user);
                } catch (error) {
                  strapi.log.error("Failed to log folder deletion:", error);
                }
              }, 0);

              return result;
            };
          } else {
            strapi.log.warn("deleteByIds method not found on folder service");
          }
        } else {
          strapi.log.warn("Folder service not found");
        }
      } catch (error) {
        strapi.log.warn("Failed to register upload service hooks:", error);
      }
    }

    // Hook into admin authentication events
    try {
      strapi.log.info("Admin auth hooks now handled by HTTP middleware");
    } catch (error) {
      strapi.log.warn("Failed to register admin authentication hooks:", error);
    }

    strapi.log.info("Audit logs entity service hooks registered");
  },
});
