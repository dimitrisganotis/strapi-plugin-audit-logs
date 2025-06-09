module.exports = ({ strapi }) => {
  // Cleanup any resources when the plugin is destroyed
  strapi.log.info("Audit logs plugin destroyed");
};
