import pluginPkg from "../../package.json";
import pluginId from "./pluginId";
import Initializer from "./components/Initializer";
import PluginIcon from "./components/PluginIcon";
import cs from "./translations/cs.json";
import de from "./translations/de.json";
import el from "./translations/el.json";
import en from "./translations/en.json";
import es from "./translations/es.json";
import fr from "./translations/fr.json";
import hu from "./translations/hu.json";
import it from "./translations/it.json";
import nl from "./translations/nl.json";
import pl from "./translations/pl.json";
import pt from "./translations/pt.json";
import ro from "./translations/ro.json";
import sv from "./translations/sv.json";

const name = pluginPkg.strapi.name;

const translations = {
  cs,
  de,
  el,
  en,
  es,
  fr,
  hu,
  it,
  nl,
  pl,
  pt,
  ro,
  sv,
};

const prefixPluginTranslations = (data) =>
  Object.keys(data).reduce((acc, current) => {
    acc[`${pluginId}.${current}`] = data[current];
    return acc;
  }, {});

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
        const data = translations[locale] || translations.en || {};

        return {
          data: prefixPluginTranslations(data),
          locale,
        };
      })
    );

    return Promise.resolve(importedTrads);
  },
};
