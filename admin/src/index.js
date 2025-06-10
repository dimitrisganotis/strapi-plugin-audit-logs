import pluginPkg from "../../package.json";
import pluginId from "./pluginId";
import Initializer from "./components/Initializer";
import PluginIcon from "./components/PluginIcon";

const name = pluginPkg.strapi.name;

export default {
  register(app) {
    app.addMenuLink({
      to: `/plugins/${pluginId}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${pluginId}.plugin.name`,
        defaultMessage: "Audit Logs",
      },
      Component: () => import("./pages/App/index"),
      permissions: [
        {
          action: "plugin::audit-logs.read",
          subject: null,
        },
      ],
    });

    app.registerPlugin({
      id: pluginId,
      initializer: Initializer,
      isReady: false,
      name,
    });
  },

  bootstrap(app) {
    // Plugin is ready
  },

  async registerTrads(app) {
    const { locales } = app;
    const importedTrads = await Promise.all(
      (locales || []).map((locale) => {
        return import(`./translations/${locale}.json`)
          .then(({ default: data }) => {
            return {
              data: Object.keys(data).reduce((acc, current) => {
                acc[`${pluginId}.${current}`] = data[current];
                return acc;
              }, {}),
              locale,
            };
          })
          .catch(() => {
            return {
              data: {},
              locale,
            };
          });
      })
    );

    return Promise.resolve(importedTrads);
  },
};
