const { DEFAULT_INDEX_TABLE_COLUMNS } = require("../config/admin-panel");

module.exports = {
  async get(ctx) {
    const pluginConfig = strapi.config.get("plugin::audit-logs", {});

    ctx.body = {
      indexTableColumns:
        pluginConfig.adminPanel?.indexTableColumns || DEFAULT_INDEX_TABLE_COLUMNS,
    };
  },
};
