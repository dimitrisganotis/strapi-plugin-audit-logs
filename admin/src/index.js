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
      (locales || []).map(async (locale) => {
        try {
          // Try to load the requested locale first
          const { default: data } = await import(`./translations/${locale}.json`);
          return {
            data: Object.keys(data).reduce((acc, current) => {
              acc[`${pluginId}.${current}`] = data[current];
              return acc;
            }, {}),
            locale,
          };
        } catch (error) {
          // If the requested locale doesn't exist, try to fall back to English
          if (locale !== 'en') {
            try {
              const { default: data } = await import(`./translations/en.json`);
              return {
                data: Object.keys(data).reduce((acc, current) => {
                  acc[`${pluginId}.${current}`] = data[current];
                  return acc;
                }, {}),
                locale,
              };
            } catch (fallbackError) {
              // If even English doesn't exist, return empty data
              return {
                data: {},
                locale,
              };
            }
          } else {
            // If English itself doesn't exist, return empty data
            return {
              data: {},
              locale,
            };
          }
        }
      })
    );

    return Promise.resolve(importedTrads);
  },
};
