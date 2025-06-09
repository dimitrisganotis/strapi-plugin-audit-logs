import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Layout,
  BaseHeaderLayout,
  ContentLayout,
  ActionLayout,
  Button,
  Box,
  Typography,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  TextInput,
  SingleSelect,
  SingleSelectOption,
  Loader,
  ModalLayout,
  ModalHeader,
  ModalBody,
  JSONInput,
} from "@strapi/design-system";
import { Eye, Trash } from "@strapi/icons";
import { useIntl } from "react-intl";
import { useFetchClient, useNotification, auth } from "@strapi/helper-plugin";
import getTrad from "../../utils/getTrad";

const HomePage = () => {
  const { formatMessage, formatDate } = useIntl();
  const { get, post } = useFetchClient();
  const toggleNotification = useNotification();
  const fetchTimeoutRef = useRef(null);

  // Get user info to check if super admin
  const userInfo = auth.get("userInfo");
  const isSuperAdmin =
    userInfo?.roles?.some((role) => role.code === "strapi-super-admin") ||
    false;

  // Simplified permissions - no RBAC needed
  const canRead = true; // User already passed menu permissions
  const canCleanup = isSuperAdmin; // Only super admins can cleanup
  const canViewDetails = true; // Everyone who can read can view details

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
    dateFrom: "",
    dateTo: "",
  });
  const [sort, setSort] = useState("date:desc");
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchLogs = async () => {
    // Clear any pending fetch to debounce rapid clicks
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Add small delay to debounce rapid pagination clicks
    fetchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          page: pagination.page,
          pageSize: pagination.pageSize,
          sort,
          ...Object.fromEntries(
            Object.entries(filters).filter(([_, value]) => value)
          ),
        });

        const { data } = await get(`/audit-logs/audit-logs?${query}`);
        setLogs(data.data);
        setPagination(data.meta.pagination);
      } catch (error) {
        // Ignore canceled requests (happens when user clicks pagination quickly)
        if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
          return;
        }

        toggleNotification({
          type: "warning",
          message: formatMessage({
            id: getTrad("notification.error.fetch"),
            defaultMessage: "Failed to fetch audit logs",
          }),
        });
      } finally {
        setLoading(false);
      }
    }, 100); // 100ms debounce to prevent rapid-fire requests
  };

  const handleCleanup = async () => {
    try {
      await post("/audit-logs/audit-logs/cleanup");
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTrad("notification.success.cleanup"),
          defaultMessage: "Cleanup completed successfully",
        }),
      });
      fetchLogs();
    } catch (error) {
      toggleNotification({
        type: "warning",
        message: formatMessage({
          id: getTrad("notification.error.cleanup"),
          defaultMessage: "Failed to cleanup logs",
        }),
      });
    }
  };

  const handleViewDetails = async (logId) => {
    try {
      const { data } = await get(`/audit-logs/audit-logs/${logId}`);
      setSelectedLog(data.data);
      setModalOpen(true);
    } catch (error) {
      toggleNotification({
        type: "warning",
        message: formatMessage({
          id: getTrad("notification.error.details"),
          defaultMessage: "Failed to fetch log details",
        }),
      });
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [
    pagination.page,
    pagination.pageSize,
    sort,
    filters.user,
    filters.actionType,
    filters.dateFrom,
    filters.dateTo,
  ]);

  const getActionBadgeStyle = (action) => {
    let backgroundColor = "#f6f6f9"; // neutral/gray
    let color = "#32324d";

    if (action.includes(".create")) {
      backgroundColor = "#c6f7d0"; // green
      color = "#2f755a";
    } else if (action.includes(".update")) {
      backgroundColor = "#e0e6ff"; // blue
      color = "#4945ff";
    } else if (action.includes(".delete")) {
      backgroundColor = "#ffe6e6"; // red
      color = "#d02b20";
    } else if (action.includes(".publish")) {
      backgroundColor = "#d4edda"; // success green
      color = "#155724";
    } else if (action.includes(".unpublish")) {
      backgroundColor = "#fff3cd"; // warning yellow
      color = "#856404";
    } else if (action.includes("auth.success") || action.includes("login")) {
      backgroundColor = "#c6f7d0"; // green
      color = "#2f755a";
    } else if (action.includes("auth.failure")) {
      backgroundColor = "#ffe6e6"; // red
      color = "#d02b20";
    } else if (action.includes("logout")) {
      backgroundColor = "#e0e6ff"; // blue
      color = "#4945ff";
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

  const getStatusBadgeStyle = (status) => {
    let backgroundColor = "#f6f6f9"; // neutral
    let color = "#32324d";

    if (status >= 200 && status < 300) {
      backgroundColor = "#c6f7d0"; // green
      color = "#2f755a";
    } else if (status >= 400) {
      backgroundColor = "#ffe6e6"; // red
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

  return (
    <Layout>
      <BaseHeaderLayout
        title={formatMessage({
          id: getTrad("plugin.name"),
          defaultMessage: "Audit Logs",
        })}
        subtitle={formatMessage({
          id: getTrad("plugin.description"),
          defaultMessage: "Track all user interactions and system events",
        })}
        as="h1"
      />

      <ActionLayout
        startActions={
          <Flex gap={2}>
            <TextInput
              placeholder={formatMessage({
                id: getTrad("search.user"),
                defaultMessage: "User",
              })}
              aria-label={formatMessage({
                id: getTrad("search.user"),
                defaultMessage: "User",
              })}
              value={filters.user}
              onChange={(e) => setFilters({ ...filters, user: e.target.value })}
            />
            <SingleSelect
              placeholder={formatMessage({
                id: getTrad("filter.actionType"),
                defaultMessage: "Action Type",
              })}
              aria-label={formatMessage({
                id: getTrad("filter.actionType"),
                defaultMessage: "Action Type",
              })}
              value={filters.actionType}
              onChange={(value) =>
                setFilters({ ...filters, actionType: value })
              }
              onClear={() => setFilters({ ...filters, actionType: "" })}
            >
              <SingleSelectOption value="entry.create">
                Entry Create
              </SingleSelectOption>
              <SingleSelectOption value="entry.update">
                Entry Update
              </SingleSelectOption>
              <SingleSelectOption value="entry.delete">
                Entry Delete
              </SingleSelectOption>
              <SingleSelectOption value="entry.publish">
                Entry Publish
              </SingleSelectOption>
              <SingleSelectOption value="entry.unpublish">
                Entry Unpublish
              </SingleSelectOption>
              <SingleSelectOption value="media.create">
                Media Create
              </SingleSelectOption>
              <SingleSelectOption value="media.update">
                Media Update
              </SingleSelectOption>
              <SingleSelectOption value="media.delete">
                Media Delete
              </SingleSelectOption>
              <SingleSelectOption value="media-folder.create">
                Media Folder Create
              </SingleSelectOption>
              <SingleSelectOption value="media-folder.update">
                Media Folder Update
              </SingleSelectOption>
              <SingleSelectOption value="media-folder.delete">
                Media Folder Delete
              </SingleSelectOption>
              <SingleSelectOption value="user.create">
                User Create
              </SingleSelectOption>
              <SingleSelectOption value="user.update">
                User Update
              </SingleSelectOption>
              <SingleSelectOption value="user.delete">
                User Delete
              </SingleSelectOption>
              <SingleSelectOption value="admin.auth.success">
                Login Success
              </SingleSelectOption>
              <SingleSelectOption value="admin.auth.failure">
                Login Failure
              </SingleSelectOption>
              <SingleSelectOption value="admin.logout">
                Logout
              </SingleSelectOption>
              <SingleSelectOption value="content-type.create">
                Content Type Create
              </SingleSelectOption>
              <SingleSelectOption value="content-type.update">
                Content Type Update
              </SingleSelectOption>
              <SingleSelectOption value="content-type.delete">
                Content Type Delete
              </SingleSelectOption>
              <SingleSelectOption value="component.create">
                Component Create
              </SingleSelectOption>
              <SingleSelectOption value="component.update">
                Component Update
              </SingleSelectOption>
              <SingleSelectOption value="component.delete">
                Component Delete
              </SingleSelectOption>
              <SingleSelectOption value="role.create">
                Role Create
              </SingleSelectOption>
              <SingleSelectOption value="role.update">
                Role Update
              </SingleSelectOption>
              <SingleSelectOption value="role.delete">
                Role Delete
              </SingleSelectOption>
            </SingleSelect>
          </Flex>
        }
        endActions={
          canCleanup && (
            <Button
              variant="secondary"
              startIcon={<Trash />}
              onClick={handleCleanup}
            >
              {formatMessage({
                id: getTrad("button.cleanup"),
                defaultMessage: "Cleanup Old Logs",
              })}
            </Button>
          )
        }
      />

      <ContentLayout>
        {loading ? (
          <Box padding={8} textAlign="center">
            <Loader />
          </Box>
        ) : (
          <>
            <Table colCount={7} rowCount={logs.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.action"),
                        defaultMessage: "Action",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.date"),
                        defaultMessage: "Date",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.user"),
                        defaultMessage: "User",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.method"),
                        defaultMessage: "Method",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.status"),
                        defaultMessage: "Status",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.ip"),
                        defaultMessage: "IP Address",
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({
                        id: getTrad("table.actions"),
                        defaultMessage: "Actions",
                      })}
                    </Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log) => (
                  <Tr key={log.id}>
                    <Td>
                      <Typography style={getActionBadgeStyle(log.action)}>
                        {log.action}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography variant="sigma">
                        {new Intl.DateTimeFormat("en-GB", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(log.date))}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography variant="sigma">
                        {log.userDisplayName || log.userEmail || "-"}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography variant="sigma">
                        {log.method || "-"}
                      </Typography>
                    </Td>
                    <Td>
                      {log.statusCode && (
                        <Typography style={getStatusBadgeStyle(log.statusCode)}>
                          {log.statusCode}
                        </Typography>
                      )}
                    </Td>
                    <Td>
                      <Typography variant="sigma">
                        {log.ipAddress || "-"}
                      </Typography>
                    </Td>
                    <Td>
                      {canViewDetails && (
                        <Button
                          variant="ghost"
                          startIcon={<Eye />}
                          onClick={() => handleViewDetails(log.id)}
                        >
                          {formatMessage({
                            id: getTrad("button.view"),
                            defaultMessage: "View",
                          })}
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {/* Pagination */}
            {pagination.pageCount > 1 && (
              <Box paddingTop={4}>
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
                    ← Previous
                  </Button>

                  <Typography variant="pi" textColor="neutral600">
                    Page {pagination.page} of {pagination.pageCount}
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
                    Next →
                  </Button>

                  {/* Quick jump to pages */}
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
                          arr.indexOf(page) === index
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
                              setPagination({ ...pagination, page })
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
      </ContentLayout>

      {modalOpen && selectedLog && (
        <ModalLayout onClose={() => setModalOpen(false)} labelledBy="title">
          <ModalHeader>
            <Typography
              fontWeight="bold"
              textColor="neutral800"
              as="h2"
              id="title"
            >
              {formatMessage({
                id: getTrad("modal.title"),
                defaultMessage: "Audit Log Details",
              })}
            </Typography>
          </ModalHeader>
          <ModalBody>
            <Box padding={4}>
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Flex justifyContent="space-between">
                  <Typography fontWeight="semiBold">Action:</Typography>
                  <Typography style={getActionBadgeStyle(selectedLog.action)}>
                    {selectedLog.action}
                  </Typography>
                </Flex>
                <Flex justifyContent="space-between">
                  <Typography fontWeight="semiBold">Date:</Typography>
                  <Typography>
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "full",
                      timeStyle: "long",
                    }).format(new Date(selectedLog.date))}
                  </Typography>
                </Flex>
                <Flex justifyContent="space-between">
                  <Typography fontWeight="semiBold">User:</Typography>
                  <Typography>
                    {selectedLog.userDisplayName ||
                      selectedLog.userEmail ||
                      "System"}
                  </Typography>
                </Flex>
                {selectedLog.endpoint && (
                  <Flex justifyContent="space-between">
                    <Typography fontWeight="semiBold">Endpoint:</Typography>
                    <Typography>{selectedLog.endpoint}</Typography>
                  </Flex>
                )}
                {selectedLog.method && (
                  <Flex justifyContent="space-between">
                    <Typography fontWeight="semiBold">Method:</Typography>
                    <Typography>{selectedLog.method}</Typography>
                  </Flex>
                )}
                {selectedLog.statusCode && (
                  <Flex justifyContent="space-between">
                    <Typography fontWeight="semiBold">Status:</Typography>
                    <Typography
                      style={getStatusBadgeStyle(selectedLog.statusCode)}
                    >
                      {selectedLog.statusCode}
                    </Typography>
                  </Flex>
                )}
                {selectedLog.ipAddress && (
                  <Flex justifyContent="space-between">
                    <Typography fontWeight="semiBold">IP Address:</Typography>
                    <Typography>{selectedLog.ipAddress}</Typography>
                  </Flex>
                )}
                {selectedLog.userAgent && (
                  <Flex direction="column" alignItems="stretch">
                    <Typography fontWeight="semiBold">User Agent:</Typography>
                    <Typography>{selectedLog.userAgent}</Typography>
                  </Flex>
                )}
                {selectedLog.payload && (
                  <Box>
                    <Typography fontWeight="semiBold" paddingBottom={4}>
                      Data:
                    </Typography>
                    <JSONInput
                      value={JSON.stringify(selectedLog.payload, null, 2)}
                      disabled
                    />
                  </Box>
                )}
              </Flex>
            </Box>
          </ModalBody>
        </ModalLayout>
      )}
    </Layout>
  );
};

export default HomePage;
