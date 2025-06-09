module.exports = {
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/audit-logs",
      handler: "log.find",
      config: {
        policies: [
          "admin::isAuthenticatedAdmin",
          {
            name: "admin::hasPermissions",
            config: {
              actions: ["plugin::audit-logs.read"],
            },
          },
        ],
      },
    },
    {
      method: "GET",
      path: "/audit-logs/count",
      handler: "log.count",
      config: {
        policies: [
          "admin::isAuthenticatedAdmin",
          {
            name: "admin::hasPermissions",
            config: {
              actions: ["plugin::audit-logs.read"],
            },
          },
        ],
      },
    },
    {
      method: "GET",
      path: "/audit-logs/:id",
      handler: "log.findOne",
      config: {
        policies: [
          "admin::isAuthenticatedAdmin",
          {
            name: "admin::hasPermissions",
            config: {
              actions: ["plugin::audit-logs.details"],
            },
          },
        ],
      },
    },
    {
      method: "POST",
      path: "/audit-logs/cleanup",
      handler: "log.cleanup",
      config: {
        policies: [
          "admin::isAuthenticatedAdmin",
          // Only super admins can cleanup - no specific permission needed
        ],
      },
    },
  ],
};
