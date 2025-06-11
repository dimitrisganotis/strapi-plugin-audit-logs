"use strict";

module.exports = {
  kind: "collectionType",
  collectionName: "audit_logs",
  info: {
    singularName: "log",
    pluralName: "logs",
    displayName: "Audit Log",
    description: "Audit logs for tracking user actions",
  },
  options: {
    draftAndPublish: false,
    comment: "",
  },
  pluginOptions: {
    "content-manager": {
      visible: false,
    },
    "content-type-builder": {
      visible: false,
    },
  },
  attributes: {
    action: {
      type: "string",
      required: true,
    },
    date: {
      type: "datetime",
      required: true,
    },
    payload: {
      type: "json",
    },
    userId: {
      type: "integer",
    },
    userDisplayName: {
      type: "string",
    },
    userEmail: {
      type: "string",
    },
    user: {
      type: "relation",
      relation: "manyToOne",
      target: "admin::user",
    },
    endpoint: {
      type: "string",
    },
    method: {
      type: "string",
    },
    statusCode: {
      type: "integer",
    },
    ipAddress: {
      type: "string",
    },
    userAgent: {
      type: "text",
    },
    requestBody: {
      type: "json",
    },
    responseBody: {
      type: "json",
    },
  },
};
