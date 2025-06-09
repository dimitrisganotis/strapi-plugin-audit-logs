module.exports = ({ strapi }) => {
  // Register permissions
  const actions = [
    {
      section: "plugins",
      displayName: "View Audit Logs",
      uid: "read",
      pluginName: "audit-logs",
    },
    {
      section: "plugins",
      displayName: "Access Audit Log Details",
      uid: "details",
      pluginName: "audit-logs",
    },
  ];

  // Register permissions immediately
  strapi.admin.services.permission.actionProvider.registerMany(actions);
};
