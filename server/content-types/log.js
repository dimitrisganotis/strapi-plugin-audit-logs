"use strict";

module.exports = {
  kind: "collectionType",
  collectionName: "audit_logs",
  info: {
    singularName: "log",
    pluralName: "logs",
    displayName: "Audit Log",
    description: "System audit logs for tracking user interactions and events",
  },
  options: {
    draftAndPublish: false,
    timestamps: true,
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
      maxLength: 255,
    },
    date: {
      type: "datetime",
      required: true,
    },
    payload: {
      type: "json",
    },
    user: {
      type: "relation",
      relation: "manyToOne",
      target: "admin::user",
    },
    userId: {
      type: "integer",
    },
    userDisplayName: {
      type: "string",
      maxLength: 255,
    },
    userEmail: {
      type: "email",
      maxLength: 255,
    },
    endpoint: {
      type: "string",
      maxLength: 500,
    },
    method: {
      type: "string",
      maxLength: 10,
    },
    statusCode: {
      type: "integer",
      min: 100,
      max: 599,
    },
    ipAddress: {
      type: "string",
      maxLength: 45, // IPv6 max length
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
    duration: {
      type: "integer",
      min: 0,
    },
  },
};
