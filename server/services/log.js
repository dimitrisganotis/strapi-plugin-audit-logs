"use strict";

const { scheduleJob } = require("node-schedule");

module.exports = ({ strapi }) => ({
  async createLog(logData) {
    const config =
      strapi.config.get("plugin::audit-logs") ||
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

      // Use Document Service API for Strapi v5
      const log = await strapi.documents("plugin::audit-logs.log").create({
        data: {
          ...redactedData,
          date: new Date(),
        },
      });

      return log;
    } catch (error) {
      strapi.log.error("Failed to create audit log:", error);
      throw error;
    }
  },

  async findMany(params = {}) {
    try {
      const { filters, sort, start, limit, ...otherParams } = params;

      // Use Document Service API for Strapi v5
      const logs = await strapi.documents("plugin::audit-logs.log").findMany({
        filters: filters,
        sort: sort || { date: "desc" },
        start: start,
        limit: limit,
        populate: {
          user: true,
        },
        ...otherParams,
      });
      return logs;
    } catch (error) {
      strapi.log.error("Failed to fetch audit logs:", error);
      throw error;
    }
  },

  async findOne(id) {
    try {
      // Use Document Service API for Strapi v5
      // Try with documentId first, then fall back to id
      let log = null;

      try {
        log = await strapi.documents("plugin::audit-logs.log").findOne({
          documentId: id,
          populate: {
            user: true,
          },
        });
      } catch (error) {
        // DocumentId lookup failed, try with regular id
        log = null;
      }

      // If documentId approach didn't work, try with id filter
      if (!log) {
        const logs = await strapi.documents("plugin::audit-logs.log").findMany({
          filters: { id: { $eq: id } },
          populate: {
            user: true,
          },
          limit: 1,
        });

        log = logs.length > 0 ? logs[0] : null;
      }

      // If still not found, try parsing as number
      if (!log) {
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
          const logsById = await strapi
            .documents("plugin::audit-logs.log")
            .findMany({
              filters: { id: { $eq: numericId } },
              populate: { user: true },
              limit: 1,
            });

          log = logsById.length > 0 ? logsById[0] : null;
        }
      }

      return log;
    } catch (error) {
      strapi.log.error("Failed to fetch audit log:", error);
      throw error;
    }
  },

  async count(params = {}) {
    try {
      const { filters } = params;

      // Use Document Service API for Strapi v5
      const count = await strapi.documents("plugin::audit-logs.log").count({
        filters: filters,
      });

      return count;
    } catch (error) {
      strapi.log.error("Failed to count audit logs:", error);
      throw error;
    }
  },

  async deleteMany(filters = {}) {
    try {
      // For deleteMany, we need to find first, then delete
      const logsToDelete = await strapi
        .documents("plugin::audit-logs.log")
        .findMany({
          filters: filters,
        });

      let deletedCount = 0;
      for (const log of logsToDelete) {
        await strapi.documents("plugin::audit-logs.log").delete({
          documentId: log.documentId,
        });
        deletedCount++;
      }

      return { count: deletedCount };
    } catch (error) {
      strapi.log.error("Failed to delete audit logs:", error);
      throw error;
    }
  },

  redactSensitiveData(data, redactedValues = []) {
    if (!redactedValues.length) return data;

    const redact = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(redact);
      }

      if (obj && typeof obj === "object") {
        const redacted = { ...obj };
        for (const key in redacted) {
          if (redacted.hasOwnProperty(key)) {
            const lowerKey = key.toLowerCase();
            if (
              redactedValues.some((val) => lowerKey.includes(val.toLowerCase()))
            ) {
              redacted[key] = "[REDACTED]";
            } else if (
              typeof redacted[key] === "object" &&
              redacted[key] !== null
            ) {
              redacted[key] = redact(redacted[key]);
            }
          }
        }
        return redacted;
      }

      return obj;
    };

    return redact(data);
  },

  getClientIP(ctx) {
    // Try multiple sources for the real IP address
    const xForwardedFor = ctx.request.headers["x-forwarded-for"];
    const xRealIp = ctx.request.headers["x-real-ip"];
    const xClientIp = ctx.request.headers["x-client-ip"];
    const cfConnectingIp = ctx.request.headers["cf-connecting-ip"]; // Cloudflare
    const requestIp = ctx.request.ip;
    const connectionRemoteAddress = ctx.request.connection?.remoteAddress;
    const socketRemoteAddress = ctx.request.socket?.remoteAddress;

    // Priority order for IP detection
    let ip =
      cfConnectingIp || // Cloudflare real IP
      xRealIp || // Nginx real IP
      xClientIp || // Other proxy real IP
      (xForwardedFor && xForwardedFor.split(",")[0].trim()) || // First IP in forwarded chain
      requestIp || // Koa request IP
      connectionRemoteAddress || // Connection remote address
      socketRemoteAddress || // Socket remote address
      "unknown";

    // Clean up common IPv6 loopback representations
    if (ip === "::1" || ip === "::ffff:127.0.0.1") {
      ip = "127.0.0.1";
    }

    strapi.log.debug("Selected IP address:", ip);

    return ip;
  },

  async logEvent(action, data = {}, user = null) {
    try {
      const config =
        strapi.config.get("plugin::audit-logs") ||
        strapi.plugin("audit-logs").config;

      if (!config?.enabled) {
        return null;
      }

      // CRITICAL: Prevent recursion - never log audit log operations
      if (
        action.includes("plugin::audit-logs.log") ||
        data?.uid === "plugin::audit-logs.log" ||
        data?.model === "log"
      ) {
        return null;
      }

      // Check if endpoint should be excluded
      if (data.endpoint && config.excludeEndpoints) {
        const shouldExclude = config.excludeEndpoints.some(
          (excludedEndpoint) => {
            // Support both exact matches and pattern matching
            if (excludedEndpoint.includes("*")) {
              // Convert wildcard to regex
              const regex = new RegExp(excludedEndpoint.replace(/\*/g, ".*"));
              return regex.test(data.endpoint);
            }
            // Exact match or starts with match
            return (
              data.endpoint === excludedEndpoint ||
              data.endpoint.startsWith(excludedEndpoint)
            );
          }
        );

        if (shouldExclude) {
          return null; // Skip logging for excluded endpoints
        }
      }

      // Check if this event type should be tracked
      if (config.events?.track && !config.events.track.includes(action)) {
        return null;
      }

      // Prepare user display information
      let userDisplayName = "System";
      let userEmail = null;
      let userId = null;

      if (user) {
        userId = user.id;
        userEmail = user.email;

        // Create display name from available user data
        if (user.username) {
          userDisplayName = user.username;
        } else if (user.email) {
          userDisplayName = user.email;
        } else if (user.firstname || user.lastname) {
          userDisplayName =
            `${user.firstname || ""} ${user.lastname || ""}`.trim();
        } else {
          userDisplayName = `User ${user.id}`;
        }
      }

      // Redact sensitive data if redactedValues are configured
      let payload = data;
      if (config.redactedValues && config.redactedValues.length > 0) {
        payload = this.redactSensitiveData(data, config.redactedValues);
      }

      const logData = {
        action,
        payload,
        userId,
        userDisplayName,
        userEmail,
        user: user ? user.id : null,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestBody: data.requestBody,
        responseBody: data.responseBody,
      };

      return await this.createLog(logData);
    } catch (error) {
      strapi.log.error("Failed to log event:", error);
      return null;
    }
  },

  initializeEventListeners() {
    const config =
      strapi.config.get("plugin::audit-logs") ||
      strapi.plugin("audit-logs").config;

    if (!config?.enabled) {
      strapi.log.info("Audit logs plugin is disabled");
      return;
    }

    // Helper function to get event type from operation and UID
    const getEventType = (uid, operation, ctx) => {
      // Skip system operations and special cases
      if (uid.startsWith("admin::") || uid.startsWith("plugin::")) {
        return null;
      }

      // Map API content types to entry events
      if (uid.startsWith("api::")) {
        return `entry.${operation}`;
      }

      // Map document operations to audit events
      const operationMap = {
        create: "entry.create",
        update: "entry.update",
        delete: "entry.delete",
      };

      return operationMap[operation] || operation;
    };

    // Clean Document Service Middleware for CRUD operations only
    strapi.documents.use(async (context, next) => {
      // Don't log audit log operations to prevent infinite recursion
      if (context.uid === "plugin::audit-logs.log") {
        return await next();
      }

      // Check if content type should be excluded
      if (
        config.excludeContentTypes &&
        config.excludeContentTypes.includes(context.uid)
      ) {
        return await next();
      }

      // Only handle basic CRUD operations, NOT publish/unpublish
      const crudOperations = ["create", "update", "delete"];
      if (!crudOperations.includes(context.action)) {
        return await next();
      }

      // Store the operation details before calling next
      const operation = context.action;
      const uid = context.uid;

      // Execute the operation
      const result = await next();

      // After the operation, log the event
      setTimeout(async () => {
        try {
          const ctx = strapi.requestContext?.get?.();
          const user = ctx?.state?.user;
          const documentId = result?.documentId || result?.id;

          // Map UID to correct event type and check if we should skip
          const eventType = getEventType(uid, operation, ctx);

          // Skip if this is a publish/unpublish operation (handled by HTTP middleware)
          if (!eventType) {
            return;
          }

          const logData = {
            uid,
            id: documentId,
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

          await this.logEvent(eventType, logData, user);
        } catch (error) {
          strapi.log.error("Failed to log audit event:", error);
        }
      }, 0);

      return result;
    });

    // Comprehensive HTTP Middleware for admin panel operations and special cases
    strapi.server.use(async (ctx, next) => {
      const { method, url } = ctx.request;

      // Check for admin login
      if (method === "POST" && url === "/admin/login") {
        ctx.state.loginEmail = ctx.request.body?.email;
      }

      // Check for admin logout
      if (method === "POST" && url === "/admin/logout") {
        ctx.state.isLogout = true;
      }

      // Check for publish/unpublish actions
      if (method === "POST" && url.includes("/actions/publish")) {
        ctx.state.isPublishAction = true;
        // Extract content type and document ID from URL
        const matches = url.match(
          /\/content-manager\/collection-types\/([^\/]+)\/([^\/]+)\/actions\/publish/
        );
        if (matches) {
          ctx.state.publishContentType = matches[1];
          ctx.state.publishDocumentId = matches[2];
        }
      }

      if (method === "POST" && url.includes("/actions/unpublish")) {
        ctx.state.isUnpublishAction = true;
        // Extract content type and document ID from URL
        const matches = url.match(
          /\/content-manager\/collection-types\/([^\/]+)\/([^\/]+)\/actions\/unpublish/
        );
        if (matches) {
          ctx.state.unpublishContentType = matches[1];
          ctx.state.unpublishDocumentId = matches[2];
        }
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

      // Check for media/upload operations - ORDER MATTERS: more specific patterns first
      if (url.startsWith("/upload") || url.includes("/upload/")) {
        let mediaStateSet = false;

        // Media folder operations (highest priority)
        if (url.includes("/upload/folders")) {
          if (method === "POST") {
            ctx.state.mediaFolderCreate = true;
            mediaStateSet = true;
          } else if (method === "PUT") {
            ctx.state.mediaFolderUpdate = true;
            mediaStateSet = true;
          } else if (method === "DELETE") {
            ctx.state.mediaFolderDelete = true;
            const folderIdMatch = url.match(/\/upload\/folders\/(\d+)/);
            ctx.state.mediaFolderId = folderIdMatch ? folderIdMatch[1] : null;
            mediaStateSet = true;
          }
        }
        // Bulk delete operations (high priority)
        else if (url.includes("/upload/actions/bulk-delete")) {
          if (method === "POST") {
            ctx.state.mediaFolderDelete = true;
            mediaStateSet = true;
          }
        }
        // Media file update operations (high priority)
        else if (url.includes("/upload?id=")) {
          if (method === "POST") {
            ctx.state.mediaUpdate = true;
            const fileIdMatch = url.match(/\/upload\?id=(\d+)/);
            ctx.state.mediaFileId = fileIdMatch ? fileIdMatch[1] : null;
            mediaStateSet = true;
          }
        }
        // Media file delete operations
        else if (url.includes("/upload/files/")) {
          if (method === "DELETE") {
            ctx.state.mediaDelete = true;
            const fileIdMatch = url.match(/\/upload\/files\/(\d+)/);
            ctx.state.mediaFileId = fileIdMatch ? fileIdMatch[1] : null;
            mediaStateSet = true;
          }
        }
        // Media upload (lowest priority - only if no other state was set)
        else if (!mediaStateSet && method === "POST" && url === "/upload") {
          ctx.state.mediaUpload = true;
          mediaStateSet = true;
        }
      }

      try {
        await next();
      } catch (error) {
        // Handle login failure by logging the attempt
        if (ctx.state.loginEmail && url === "/admin/login") {
          setTimeout(async () => {
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: error.status || 500,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              loginAttempt: {
                email: ctx.state.loginEmail,
                success: false,
                error: error.message,
              },
            };

            try {
              await this.logEvent("admin.auth.failure", logData, null);
            } catch (logError) {
              strapi.log.error("Failed to log admin login failure:", logError);
            }
          }, 0);
        }

        throw error; // Re-throw the original error
      }

      // After the request, log operations if they were successful
      if (ctx.response.status >= 200 && ctx.response.status < 300) {
        // Log admin login (success)
        if (ctx.state.loginEmail) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
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
              strapi.log.error("Failed to log admin logout event:", error);
            }
          }, 0);
        }

        // Log publish actions
        if (ctx.state.isPublishAction) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              uid: ctx.state.publishContentType,
              id: ctx.state.publishDocumentId,
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.response?.body,
            };

            try {
              await this.logEvent("entry.publish", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log publish event:", error);
            }
          }, 0);
        }

        // Log unpublish actions
        if (ctx.state.isUnpublishAction) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              uid: ctx.state.unpublishContentType,
              id: ctx.state.unpublishDocumentId,
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.response?.body,
            };

            try {
              await this.logEvent("entry.unpublish", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log unpublish event:", error);
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

        // Log media operations
        if (ctx.state.mediaUpload) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.response?.body,
            };

            try {
              await this.logEvent("media.create", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log media upload:", error);
            }
          }, 0);
        }

        if (ctx.state.mediaUpdate) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              id: ctx.state.mediaFileId,
              data: ctx.request.body,
            };

            try {
              await this.logEvent("media.update", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log media update:", error);
            }
          }, 0);
        }

        if (ctx.state.mediaDelete) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              id: ctx.state.mediaFileId,
            };

            try {
              await this.logEvent("media.delete", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log media deletion:", error);
            }
          }, 0);
        }

        if (ctx.state.mediaFolderCreate) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              data: ctx.response?.body,
            };

            try {
              await this.logEvent("media-folder.create", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log media folder creation:", error);
            }
          }, 0);
        }

        if (ctx.state.mediaFolderUpdate) {
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
              await this.logEvent("media-folder.update", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log media folder update:", error);
            }
          }, 0);
        }

        if (ctx.state.mediaFolderDelete) {
          setTimeout(async () => {
            const user = ctx.state?.user;
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              id: ctx.state.mediaFolderId,
            };

            try {
              await this.logEvent("media-folder.delete", logData, user);
            } catch (error) {
              strapi.log.error("Failed to log media folder deletion:", error);
            }
          }, 0);
        }
      } else if (ctx.response.status >= 400) {
        // Log failed admin login attempts
        if (
          ctx.state.loginEmail &&
          method === "POST" &&
          url === "/admin/login"
        ) {
          setTimeout(async () => {
            const logData = {
              endpoint: ctx.request?.url,
              method: ctx.request?.method,
              statusCode: ctx.response?.status,
              ipAddress: this.getClientIP(ctx),
              userAgent: ctx.request?.headers?.["user-agent"],
              loginAttempt: {
                email: ctx.state.loginEmail,
                success: false,
                error:
                  ctx.response?.body?.error?.message || "Authentication failed",
              },
            };

            try {
              await this.logEvent("admin.auth.failure", logData, null);
            } catch (error) {
              strapi.log.error("Failed to log admin login failure:", error);
            }
          }, 0);
        }
      }
    });

    strapi.log.info(
      "Audit logs event listeners setup complete with comprehensive HTTP middleware"
    );
  },

  setupCleanupJob() {
    const config =
      strapi.config.get("plugin::audit-logs") ||
      strapi.plugin("audit-logs").config;

    if (!config?.enabled || !config.deletion?.enabled) {
      strapi.log.info("Audit logs automatic cleanup is disabled");
      return;
    }

    // Use deletion config structure
    const { frequency, options } = config.deletion;
    const jobSchedule = "0 2 * * *"; // Daily at 2 AM

    scheduleJob(jobSchedule, async () => {
      try {
        strapi.log.info("Starting scheduled audit logs cleanup...");

        if (frequency === "logAge") {
          await this.cleanupByAge(options);
        } else if (frequency === "logCount") {
          await this.cleanupByCount(options);
        } else {
          strapi.log.warn("Invalid cleanup frequency:", frequency);
        }
      } catch (error) {
        strapi.log.error("Failed to cleanup old audit logs:", error);
      }
    });

    strapi.log.info(
      `Audit logs cleanup job scheduled: ${jobSchedule} (${frequency}: ${JSON.stringify(options)})`
    );
  },

  // Cleanup method for manual cleanup
  async cleanupOldLogs() {
    const config =
      strapi.config.get("plugin::audit-logs") ||
      strapi.plugin("audit-logs").config;

    // Use the deletion config structure that matches the existing format
    if (!config?.deletion?.enabled) {
      strapi.log.info("Audit logs cleanup is disabled");
      return { count: 0 };
    }

    const { frequency, options } = config.deletion;

    if (frequency === "logAge") {
      return await this.cleanupByAge(options);
    } else if (frequency === "logCount") {
      return await this.cleanupByCount(options);
    } else {
      strapi.log.warn("Invalid cleanup frequency:", frequency);
      return { count: 0 };
    }
  },

  async cleanupByAge(options) {
    const { value, interval } = options;

    // Handle case where value is 0 - delete all logs
    if (value === 0) {
      strapi.log.info("Cleanup value is 0 - deleting all audit logs");
      const allLogs = await this.findMany({});
      const deleted = await this.deleteMany({});
      strapi.log.info(`Deleted all ${deleted.count || 0} audit logs`);
      return deleted;
    }

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
        return { count: 0 };
    }

    const deleted = await this.deleteMany({
      date: { $lt: cutoffDate },
    });

    strapi.log.info(
      `Manual audit logs cleanup: deleted ${deleted.count || 0} logs older than ${value} ${interval}(s)`
    );

    return deleted;
  },

  async cleanupByCount(options) {
    const { value } = options;

    if (value === 0) {
      // Delete all logs
      strapi.log.info("Cleanup value is 0 - deleting all audit logs");
      const deleted = await this.deleteMany({});
      strapi.log.info(`Deleted all ${deleted.count || 0} audit logs`);
      return deleted;
    }

    try {
      const totalLogs = await this.count();

      if (totalLogs <= value) {
        strapi.log.info(
          `Only ${totalLogs} logs exist, keeping all (limit: ${value})`
        );
        return { count: 0 };
      }

      const logsToDelete = totalLogs - value;

      // Get the oldest logs to delete
      const oldestLogs = await this.findMany({
        sort: { date: "asc" },
        limit: logsToDelete,
      });

      let deletedCount = 0;
      for (const log of oldestLogs) {
        await strapi.documents("plugin::audit-logs.log").delete({
          documentId: log.documentId,
        });
        deletedCount++;
      }

      strapi.log.info(
        `Manual audit logs cleanup: deleted ${deletedCount} old logs to maintain ${value} total logs`
      );

      return { count: deletedCount };
    } catch (error) {
      strapi.log.error("Failed to cleanup logs by count:", error);
      throw error;
    }
  },
});
