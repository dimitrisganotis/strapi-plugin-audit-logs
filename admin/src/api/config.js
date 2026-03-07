import { getFetchClient } from "@strapi/admin/strapi-admin";

export const fetchPluginConfig = async () => {
  const { get } = getFetchClient();
  const { data } = await get("/audit-logs/config");
  return data;
};
