import React, { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  LinkButton,
  Loader,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system";
import { ArrowClockwise, Eye } from "@strapi/icons";
import { useIntl } from "react-intl";
import {
  Layouts,
  useFetchClient,
  useNotification,
  useRBAC,
} from "@strapi/strapi/admin";
import { fetchPluginConfig } from "../../api/config";
import getTrad from "../../utils/getTrad";

const DEFAULT_INDEX_TABLE_COLUMNS = [
  "action",
  "date",
  "user",
  "method",
  "status",
  "ipAddress",
  "entry",
];

const ACTION_TYPES = [
  "entry.create",
  "entry.update",
  "entry.delete",
  "entry.publish",
  "entry.unpublish",
  "media.create",
  "media.update",
  "media.delete",
  "media-folder.create",
  "media-folder.update",
  "media-folder.delete",
  "user.create",
  "user.update",
  "user.delete",
  "role.create",
  "role.update",
  "role.delete",
  "admin.auth.success",
  "admin.auth.failure",
  "admin.logout",
];

const formatDateString = (dateString, options = {}) => {
  if (!dateString) return "-";

  try {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
      ...options,
    }).format(date);
  } catch (error) {
    return dateString || "-";
  }
};

const getActionBadge = (action, text) => {
  let variant = "secondary";

  if (action && typeof action === "string") {
    const actionLower = action.toLowerCase();

    if (actionLower.includes("create") || actionLower.includes("success")) {
      variant = "success";
    } else if (actionLower.includes("update") || actionLower.includes("logout")) {
      variant = "primary";
    } else if (actionLower.includes("delete")) {
      variant = "danger";
    } else if (actionLower.includes("unpublish")) {
      variant = "warning";
    } else if (actionLower.includes("publish")) {
      variant = "success";
    }
  }

  return <Badge variant={variant}>{text}</Badge>;
};

const getStatusBadgeStyle = (status) => {
  let backgroundColor = "#f6f6f9";
  let color = "#32324d";

  if (status >= 200 && status < 300) {
    backgroundColor = "#c6f7d0";
    color = "#2f755a";
  } else if (status >= 400) {
    backgroundColor = "#ffe6e6";
    color = "#d02b20";
  }

  return {
    backgroundColor,
    color,
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    display: "inline-block",
    border: `1px solid ${backgroundColor}`,
  };
};

const canOpenEntry = (log) =>
  log?.action?.startsWith("entry.") &&
  Boolean(log?.payload?.uid) &&
  Boolean(log?.payload?.id);

const HomePage = () => {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [config, setConfig] = useState({
    indexTableColumns: DEFAULT_INDEX_TABLE_COLUMNS,
  });

  const { isLoading: isLoadingPermissions, allowedActions } = useRBAC([
    {
      action: "plugin::audit-logs.details",
      subject: null,
    },
  ]);

  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    pageCount: 0,
    total: 0,
  });
  const [filters, setFilters] = useState({
    user: "",
    actionType: "",
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const getUserDisplay = (auditUser) => {
    if (!auditUser) {
      return formatMessage({ id: getTrad("fallback.system") });
    }

    if (typeof auditUser === "string") {
      return auditUser;
    }

    return (
      `${auditUser.firstname || ""} ${auditUser.lastname || ""}`.trim() ||
      auditUser.username ||
      auditUser.email ||
      formatMessage({ id: getTrad("fallback.user") })
    );
  };

  const getDisplayColumns = () =>
    Array.isArray(config?.indexTableColumns)
      ? config.indexTableColumns
      : DEFAULT_INDEX_TABLE_COLUMNS;

  const buildQueryParams = () => {
    const params = new URLSearchParams({
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort: "date:desc",
    });

    if (filters.user && filters.user.trim()) {
      params.append("user", filters.user.trim());
    }

    if (filters.actionType && filters.actionType.trim()) {
      params.append("action", filters.actionType.trim());
    }

    return params;
  };

  const fetchLogs = async () => {
    setLoading(true);

    try {
      const query = buildQueryParams();
      const { data } = await get(`/audit-logs/audit-logs?${query}`);

      setLogs(data.data);
      setPagination(data.meta.pagination);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toggleNotification({
        type: "danger",
        message: formatMessage({
          id: getTrad("notification.error.fetch"),
        }),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaningUp(true);

    try {
      await post("/audit-logs/audit-logs/cleanup");
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTrad("notification.success.cleanup"),
        }),
      });
      fetchLogs();
    } catch (error) {
      toggleNotification({
        type: "danger",
        message: formatMessage({
          id: getTrad("notification.error.cleanup"),
        }),
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleViewDetails = async (logId) => {
    if (!isLoadingPermissions && !allowedActions?.canDetails) {
      toggleNotification({
        type: "danger",
        message: formatMessage({
          id: getTrad("notification.error.permissions"),
        }),
      });
      return;
    }

    try {
      setIsModalOpen(true);
      const response = await get(`/audit-logs/audit-logs/${logId}`);
      const fallbackLog = logs.find((log) => log.id === logId);

      setSelectedLog(response.data?.data || response.data || fallbackLog);
    } catch (error) {
      console.error("Failed to fetch log details:", error);

      const fallbackLog = logs.find((log) => log.id === logId);

      if (fallbackLog) {
        setSelectedLog(fallbackLog);
      } else {
        toggleNotification({
          type: "danger",
          message: formatMessage({
            id: getTrad("notification.error.details"),
          }),
        });
        setIsModalOpen(false);
      }
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    handleFilterChange({
      user: "",
      actionType: "",
    });
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await get("/admin/users/me");
        setUser(response.data?.data || response.data);
      } catch (error) {
        setUser(null);
      }
    };

    fetchUser();
  }, [get]);

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, pagination.pageSize, filters.user, filters.actionType]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const pluginConfig = await fetchPluginConfig();
        if (Array.isArray(pluginConfig?.indexTableColumns)) {
          setConfig(pluginConfig);
        }
      } catch (error) {
        setConfig({ indexTableColumns: DEFAULT_INDEX_TABLE_COLUMNS });
      }
    };

    loadConfig();
  }, []);

  const isSuperAdmin =
    (user?.roles || user?.data?.roles)?.some(
      (role) =>
        role.code === "strapi-super-admin" || role.name === "Super Admin",
    ) || false;

  const displayColumns = getDisplayColumns();

  return (
    <>
      <Layouts.Header
        title={formatMessage({
          id: getTrad("page.title"),
        })}
        subtitle={formatMessage({
          id: getTrad("page.subtitle"),
        })}
        primaryAction={
          <Flex gap={2}>
            <Button
              variant="secondary"
              startIcon={<ArrowClockwise />}
              onClick={fetchLogs}
            >
              {formatMessage({
                id: getTrad("button.refresh"),
              })}
            </Button>
            {isSuperAdmin && (
              <Button
                variant="secondary"
                startIcon={<ArrowClockwise />}
                onClick={handleCleanup}
                loading={isCleaningUp}
              >
                {formatMessage({
                  id: getTrad("button.cleanup"),
                })}
              </Button>
            )}
          </Flex>
        }
      />

      <Layouts.Content>
        <Box
          background="neutral0"
          hasRadius
          shadow="filterShadow"
          paddingTop={4}
          paddingBottom={4}
          paddingLeft={6}
          paddingRight={6}
          marginBottom={4}
        >
          <Flex gap={4} alignItems="center">
            <TextInput
              placeholder={formatMessage({
                id: getTrad("filter.user"),
              })}
              value={filters.user}
              onChange={(event) =>
                handleFilterChange({ ...filters, user: event.target.value })
              }
            />
            <SingleSelect
              placeholder={formatMessage({
                id: getTrad("filter.action"),
              })}
              value={filters.actionType}
              onChange={(value) =>
                handleFilterChange({ ...filters, actionType: value })
              }
              onClear={() => handleFilterChange({ ...filters, actionType: "" })}
            >
              {ACTION_TYPES.map((actionType) => (
                <SingleSelectOption key={actionType} value={actionType}>
                  {formatMessage({
                    id: getTrad(actionType),
                  })}
                </SingleSelectOption>
              ))}
            </SingleSelect>
            {(filters.user || filters.actionType) && (
              <Button variant="tertiary" onClick={clearFilters}>
                {formatMessage({
                  id: getTrad("button.clearFilters"),
                })}
              </Button>
            )}
          </Flex>
        </Box>

        {loading ? (
          <Box padding={8} textAlign="center">
            <Loader />
          </Box>
        ) : (
          <>
            <Table colCount={displayColumns.length + 1} rowCount={logs.length}>
              <Thead>
                <Tr>
                  {displayColumns.map((column) => (
                    <Th key={column}>
                      <Typography variant="sigma">
                        {formatMessage({
                          id: getTrad(`table.${column}`),
                        })}
                      </Typography>
                    </Th>
                  ))}
                  <Th key="actions">
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.actions"),
                      })}
                    </Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log) => (
                  <Tr key={log.id}>
                    {displayColumns.map((column) => {
                      switch (column) {
                        case "action":
                          return (
                            <Td key={column}>
                              {getActionBadge(
                                log.action,
                                formatMessage({
                                  id: getTrad(log.action),
                                }),
                              )}
                            </Td>
                          );
                        case "date":
                          return (
                            <Td key={column}>
                              <Typography variant="sigma">
                                {formatDateString(log.date)}
                              </Typography>
                            </Td>
                          );
                        case "user":
                          return (
                            <Td key={column}>
                              <Typography variant="sigma">
                                {getUserDisplay(log.user)}
                              </Typography>
                            </Td>
                          );
                        case "method":
                          return (
                            <Td key={column}>
                              <Typography variant="sigma">
                                {log.method || "-"}
                              </Typography>
                            </Td>
                          );
                        case "status":
                          return (
                            <Td key={column}>
                              {log.statusCode ? (
                                <Typography
                                  style={getStatusBadgeStyle(log.statusCode)}
                                >
                                  {log.statusCode}
                                </Typography>
                              ) : (
                                <Typography variant="sigma">-</Typography>
                              )}
                            </Td>
                          );
                        case "ipAddress":
                          return (
                            <Td key={column}>
                              <Typography variant="sigma">
                                {log.ipAddress || "-"}
                              </Typography>
                            </Td>
                          );
                        case "entry":
                          return (
                            <Td key={column}>
                              {canOpenEntry(log) ? (
                                <LinkButton
                                  variant="secondary"
                                  href={`/admin/content-manager/collection-types/${log.payload.uid}/${log.payload.id}`}
                                >
                                  {formatMessage({
                                    id: getTrad("entry.show"),
                                  })}
                                </LinkButton>
                              ) : null}
                            </Td>
                          );
                        default:
                          return <Td key={column} />;
                      }
                    })}
                    <Td>
                      {!isLoadingPermissions && allowedActions?.canDetails ? (
                        <Button
                          variant="secondary"
                          startIcon={<Eye />}
                          onClick={() => handleViewDetails(log.id)}
                        >
                          {formatMessage({
                            id: getTrad("button.viewDetails"),
                          })}
                        </Button>
                      ) : (
                        <Typography variant="sigma" textColor="neutral500">
                          {formatMessage({
                            id: getTrad("button.noAccess"),
                          })}
                        </Typography>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {pagination.pageCount > 1 && (
              <Box paddingTop={4} paddingBottom={6}>
                <Flex
                  justifyContent="space-between"
                  alignItems="center"
                  paddingBottom={3}
                >
                  <Flex gap={2} alignItems="center">
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage({
                        id: getTrad("pagination.show"),
                      })}
                      :
                    </Typography>
                    <SingleSelect
                      value={pagination.pageSize}
                      onChange={(value) => {
                        setPagination({
                          ...pagination,
                          pageSize: parseInt(value, 10),
                          page: 1,
                        });
                      }}
                    >
                      <SingleSelectOption value="10">10</SingleSelectOption>
                      <SingleSelectOption value="25">25</SingleSelectOption>
                      <SingleSelectOption value="50">50</SingleSelectOption>
                      <SingleSelectOption value="100">100</SingleSelectOption>
                    </SingleSelect>
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage({
                        id: getTrad("pagination.perPage"),
                      })}
                    </Typography>
                  </Flex>

                  <Typography variant="pi" textColor="neutral500">
                    {pagination.total}{" "}
                    {formatMessage({
                      id: getTrad("pagination.totalResults"),
                    })}
                  </Typography>
                </Flex>

                <Flex gap={2} alignItems="center">
                  <Button
                    variant="tertiary"
                    size="S"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page - 1,
                      })
                    }
                  >
                    ←{" "}
                    {formatMessage({
                      id: getTrad("pagination.previous"),
                    })}
                  </Button>

                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({
                      id: getTrad("pagination.page"),
                    })}{" "}
                    {pagination.page}{" "}
                    {formatMessage({
                      id: getTrad("pagination.of"),
                    })}{" "}
                    {pagination.pageCount}
                  </Typography>

                  <Button
                    variant="tertiary"
                    size="S"
                    disabled={pagination.page >= pagination.pageCount}
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page + 1,
                      })
                    }
                  >
                    {formatMessage({
                      id: getTrad("pagination.next"),
                    })}{" "}
                    →
                  </Button>

                  <Flex gap={1} paddingLeft={2}>
                    {[
                      1,
                      2,
                      3,
                      Math.floor(pagination.pageCount / 2),
                      pagination.pageCount - 1,
                      pagination.pageCount,
                    ]
                      .filter(
                        (page, index, arr) =>
                          page > 0 &&
                          page <= pagination.pageCount &&
                          arr.indexOf(page) === index,
                      )
                      .sort((a, b) => a - b)
                      .map((page, index, arr) => (
                        <React.Fragment key={page}>
                          {index > 0 && arr[index - 1] !== page - 1 && (
                            <Typography variant="pi" textColor="neutral400">
                              ...
                            </Typography>
                          )}
                          <Button
                            variant={
                              pagination.page === page ? "primary" : "tertiary"
                            }
                            size="S"
                            onClick={() =>
                              setPagination({
                                ...pagination,
                                page,
                              })
                            }
                          >
                            {page}
                          </Button>
                        </React.Fragment>
                      ))}
                  </Flex>
                </Flex>
              </Box>
            )}
          </>
        )}
      </Layouts.Content>

      {isModalOpen && (
        <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
          <Dialog.Content
            style={{
              width: "800px",
              maxWidth: "90vw",
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Dialog.Header>
              <Typography variant="beta" fontWeight="bold">
                {formatMessage({
                  id: getTrad("modal.title"),
                })}
              </Typography>
            </Dialog.Header>

            <Dialog.Body
              style={{
                overflow: "auto",
                flexGrow: 1,
                minHeight: 0,
              }}
            >
              {!selectedLog ? (
                <Box padding={8} textAlign="center">
                  <Loader />
                  <Typography paddingTop={2}>
                    {formatMessage({
                      id: getTrad("loading.details"),
                    })}
                  </Typography>
                </Box>
              ) : (
                <Box
                  background="neutral100"
                  padding={4}
                  hasRadius
                  marginBottom={4}
                >
                  <Flex direction="column" alignItems="stretch" gap={3}>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="semiBold" textColor="neutral800">
                        {formatMessage({
                          id: getTrad("modal.action"),
                        })}
                        :
                      </Typography>
                      <Box padding={1} paddingLeft={2} paddingRight={2} hasRadius>
                        {getActionBadge(
                          selectedLog.action,
                          formatMessage({
                            id: getTrad(selectedLog.action),
                          }),
                        )}
                      </Box>
                    </Flex>

                    <Flex justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="semiBold" textColor="neutral800">
                        {formatMessage({
                          id: getTrad("modal.date"),
                        })}
                        :
                      </Typography>
                      <Typography variant="pi">
                        {formatDateString(selectedLog.date || selectedLog.createdAt, {
                          dateStyle: "full",
                          timeStyle: "long",
                        })}
                      </Typography>
                    </Flex>

                    <Flex justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="semiBold" textColor="neutral800">
                        {formatMessage({
                          id: getTrad("modal.user"),
                        })}
                        :
                      </Typography>
                      <Typography variant="pi">
                        {getUserDisplay(selectedLog.user)}
                      </Typography>
                    </Flex>

                    {(selectedLog.endpoint || selectedLog.url) && (
                      <Flex justifyContent="space-between" alignItems="center">
                        <Typography
                          fontWeight="semiBold"
                          textColor="neutral800"
                        >
                          {formatMessage({
                            id: getTrad("modal.endpoint"),
                          })}
                          :
                        </Typography>
                        <Typography variant="pi" fontFamily="Monaco, monospace">
                          {selectedLog.endpoint || selectedLog.url}
                        </Typography>
                      </Flex>
                    )}

                    {selectedLog.method && (
                      <Flex justifyContent="space-between" alignItems="center">
                        <Typography
                          fontWeight="semiBold"
                          textColor="neutral800"
                        >
                          {formatMessage({
                            id: getTrad("modal.method"),
                          })}
                          :
                        </Typography>
                        <Typography variant="pi" fontWeight="bold">
                          {selectedLog.method}
                        </Typography>
                      </Flex>
                    )}

                    {selectedLog.statusCode && (
                      <Flex justifyContent="space-between" alignItems="center">
                        <Typography
                          fontWeight="semiBold"
                          textColor="neutral800"
                        >
                          {formatMessage({
                            id: getTrad("modal.status"),
                          })}
                          :
                        </Typography>
                        <Box
                          padding={1}
                          paddingLeft={2}
                          paddingRight={2}
                          hasRadius
                          style={getStatusBadgeStyle(selectedLog.statusCode)}
                        >
                          <Typography variant="pi" fontWeight="bold">
                            {selectedLog.statusCode}
                          </Typography>
                        </Box>
                      </Flex>
                    )}

                    {selectedLog.ipAddress && (
                      <Flex justifyContent="space-between" alignItems="center">
                        <Typography
                          fontWeight="semiBold"
                          textColor="neutral800"
                        >
                          {formatMessage({
                            id: getTrad("modal.ipAddress"),
                          })}
                          :
                        </Typography>
                        <Typography variant="pi" fontFamily="Monaco, monospace">
                          {selectedLog.ipAddress}
                        </Typography>
                      </Flex>
                    )}

                    {selectedLog.userAgent && (
                      <Box>
                        <Typography
                          fontWeight="semiBold"
                          textColor="neutral800"
                          paddingBottom={2}
                        >
                          {formatMessage({
                            id: getTrad("modal.userAgent"),
                          })}
                          :
                        </Typography>
                        <Box
                          background="neutral0"
                          padding={3}
                          hasRadius
                          style={{ wordBreak: "break-all" }}
                        >
                          <Typography variant="pi" textColor="neutral600">
                            {selectedLog.userAgent}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {(selectedLog.payload || selectedLog.data) && (
                      <Box>
                        <Typography
                          fontWeight="semiBold"
                          textColor="neutral800"
                          paddingBottom={2}
                        >
                          {formatMessage({
                            id: getTrad("modal.payload"),
                          })}
                          :
                        </Typography>
                        <Box
                          background="neutral0"
                          padding={4}
                          hasRadius
                          style={{
                            maxHeight: "200px",
                            overflow: "auto",
                            border: "1px solid #ddd",
                            fontFamily: "Monaco, Consolas, monospace",
                            fontSize: "13px",
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                            {(() => {
                              const data = selectedLog.payload || selectedLog.data;
                              const fieldsToExclude = [
                                "endpoint",
                                "url",
                                "method",
                                "statusCode",
                                "status",
                                "ipAddress",
                                "userAgent",
                              ];

                              const filteredData = Object.keys(data)
                                .filter((key) => !fieldsToExclude.includes(key))
                                .reduce((result, key) => {
                                  result[key] = data[key];
                                  return result;
                                }, {});

                              if (Object.keys(filteredData).length === 0) {
                                return formatMessage({
                                  id: getTrad("modal.noAdditionalData"),
                                });
                              }

                              return JSON.stringify(filteredData, null, 2);
                            })()}
                          </pre>
                        </Box>
                      </Box>
                    )}
                  </Flex>
                </Box>
              )}
            </Dialog.Body>

            <Dialog.Footer>
              <Button onClick={() => setIsModalOpen(false)} variant="secondary">
                {formatMessage({
                  id: getTrad("modal.close"),
                })}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </>
  );
};

export default HomePage;
