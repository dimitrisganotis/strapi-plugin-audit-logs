module.exports = [
  {
    method: "GET",
    path: "/config",
    handler: "config.get",
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
];
