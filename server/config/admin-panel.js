"use strict";

const DEFAULT_INDEX_TABLE_COLUMNS = [
  "action",
  "date",
  "user",
  "method",
  "status",
  "ipAddress",
  "entry",
];

const ALLOWED_INDEX_TABLE_COLUMNS = new Set(DEFAULT_INDEX_TABLE_COLUMNS);

module.exports = {
  DEFAULT_INDEX_TABLE_COLUMNS,
  ALLOWED_INDEX_TABLE_COLUMNS,
};
