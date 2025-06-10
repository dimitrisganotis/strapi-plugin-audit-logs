import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Loader,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Flex,
  TextInput,
  SingleSelect,
  SingleSelectOption,
  Dialog,
} from "@strapi/design-system";
import { Eye, Trash, ArrowClockwise } from "@strapi/icons";
import { useIntl } from "react-intl";
import {
  useFetchClient,
  useNotification,
  Layouts,
  useRBAC,
} from "@strapi/strapi/admin";
import getTrad from "../../utils/getTrad";

// Utility functions
const formatDateString = (dateString) => {
  if (!dateString) return "-";

  try {
    const date = new Date(dateString);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if invalid
    }

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    return dateString || "-";
  }
};

const getUserDisplay = (user) => {
  if (!user) return "System";
  if (typeof user === "string") return user;
  return (
    user.username ||
    user.email ||
    `${user.firstname || ""} ${user.lastname || ""}`.trim() ||
    "User"
  );
};

// Helper function to get badge style based on action
const getActionBadgeStyle = (action) => {
  let backgroundColor = "#f6f6f9"; // neutral/gray
  let color = "#32324d";

  if (action && typeof action === "string") {
    const actionLower = action.toLowerCase();

    if (actionLower.includes("create") || actionLower.includes("success")) {
      backgroundColor = "#c6f7d0"; // green
      color = "#2f755a";
    } else if (actionLower.includes("update")) {
      backgroundColor = "#e0e6ff"; // blue
      color = "#4945ff";
    } else if (actionLower.includes("delete")) {
      backgroundColor = "#ffe6e6"; // red
      color = "#d02b20";
    } else if (actionLower.includes("publish")) {
      backgroundColor = "#c6f7d0"; // success green
      color = "#2f755a";
    } else if (actionLower.includes("unpublish")) {
      backgroundColor = "#fff3cd"; // warning yellow
      color = "#856404";
    } else if (actionLower.includes("logout")) {
      backgroundColor = "#e0e6ff"; // blue
      color = "#4945ff";
    }
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

// Helper function to get status badge style
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

const HomePage = () => {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  // Check permissions for details access - using the correct Strapi v5 format
  const { isLoading: isLoadingPermissions, allowedActions } = useRBAC([
    {
      action: "plugin::audit-logs.details",
      subject: null,
    },
  ]);

  // Get user info using a direct API call instead of useAuth
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await get("/admin/users/me");
        // Extract the actual user data from the nested structure
        setUser(response.data?.data || response.data);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUser();
  }, [get]);

  // Check if user is super admin - handle both nested and flat structure
  const isSuperAdmin =
    (user?.roles || user?.data?.roles)?.some(
      (role) =>
        role.code === "strapi-super-admin" || role.name === "Super Admin"
    ) || false;

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

  const buildQueryParams = () => {
    const params = new URLSearchParams({
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort: "date:desc",
    });

    // Only add filters if they have values
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
        message: "Failed to fetch audit logs",
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
        message: "Cleanup completed successfully",
      });
      fetchLogs();
    } catch (error) {
      toggleNotification({
        type: "danger",
        message: "Failed to cleanup logs",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleViewDetails = async (logId) => {
    // Check if user has permission to view details
    if (!isLoadingPermissions && !allowedActions?.canDetails) {
      toggleNotification({
        type: "danger",
        message: "You don't have permission to view log details",
      });
      return;
    }

    try {
      setIsModalOpen(true); // Open modal first
      const response = await get(`/audit-logs/audit-logs/${logId}`);

      // Find the log in the current logs array as fallback
      const fallbackLog = logs.find((log) => log.id === logId);

      // Use response data if available, otherwise use fallback
      setSelectedLog(response.data?.data || response.data || fallbackLog);
    } catch (error) {
      console.error("Failed to fetch log details:", error);

      // Use the log from current list as fallback
      const fallbackLog = logs.find((log) => log.id === logId);
      if (fallbackLog) {
        setSelectedLog(fallbackLog);
      } else {
        toggleNotification({
          type: "danger",
          message: "Failed to fetch log details",
        });
        setIsModalOpen(false);
      }
    }
  };

  // Reset pagination when filters change
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 when filtering
  };

  // Clear all filters
  const clearFilters = () => {
    handleFilterChange({
      user: "",
      actionType: "",
    });
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, pagination.pageSize, filters.user, filters.actionType]);

  return (
    <>
      <Layouts.Header
        title="Audit Logs"
        subtitle="Logs of the activities that happened in the environment"
        primaryAction={
          <Flex gap={2}>
            <Button
              variant="secondary"
              startIcon={<ArrowClockwise />}
              onClick={fetchLogs}
            >
              Refresh
            </Button>
            {isSuperAdmin && (
              <Button
                variant="secondary"
                startIcon={<ArrowClockwise />}
                onClick={handleCleanup}
                loading={isCleaningUp}
              >
                Cleanup Logs
              </Button>
            )}
          </Flex>
        }
      />

      <Layouts.Content>
        {/* Filters Section */}
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
          <Flex gap={4} alignItems="end">
            <TextInput
              placeholder="User"
              value={filters.user}
              onChange={(e) =>
                handleFilterChange({ ...filters, user: e.target.value })
              }
            />
            <SingleSelect
              placeholder="Action Type"
              value={filters.actionType}
              onChange={(value) =>
                handleFilterChange({ ...filters, actionType: value })
              }
              onClear={() => handleFilterChange({ ...filters, actionType: "" })}
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
              <SingleSelectOption value="role.create">
                Role Create
              </SingleSelectOption>
              <SingleSelectOption value="role.update">
                Role Update
              </SingleSelectOption>
              <SingleSelectOption value="role.delete">
                Role Delete
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
            </SingleSelect>
            {(filters.user || filters.actionType) && (
              <Button variant="tertiary" onClick={clearFilters}>
                Clear Filters
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
            <Table colCount={7} rowCount={logs.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">Action</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Date</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">User</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Method</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Status</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">IP Address</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Actions</Typography>
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
                        {formatDateString(log.date)}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography variant="sigma">
                        {getUserDisplay(log.user)}
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
                      {!isLoadingPermissions && allowedActions?.canDetails ? (
                        <Button
                          variant="ghost"
                          startIcon={<Eye />}
                          onClick={() => handleViewDetails(log.id)}
                        >
                          View
                        </Button>
                      ) : (
                        <Typography variant="sigma" textColor="neutral500">
                          No access
                        </Typography>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {/* Pagination */}
            {pagination.pageCount > 1 && (
              <Box paddingTop={4} paddingBottom={6}>
                {/* Page size selector */}
                <Flex
                  justifyContent="space-between"
                  alignItems="center"
                  paddingBottom={3}
                >
                  <Flex gap={2} alignItems="center">
                    <Typography variant="pi" textColor="neutral600">
                      Show:
                    </Typography>
                    <SingleSelect
                      value={pagination.pageSize}
                      onChange={(value) => {
                        setPagination({
                          ...pagination,
                          pageSize: parseInt(value),
                          page: 1, // Reset to first page when changing page size
                        });
                      }}
                    >
                      <SingleSelectOption value="10">10</SingleSelectOption>
                      <SingleSelectOption value="25">25</SingleSelectOption>
                      <SingleSelectOption value="50">50</SingleSelectOption>
                      <SingleSelectOption value="100">100</SingleSelectOption>
                    </SingleSelect>
                    <Typography variant="pi" textColor="neutral600">
                      per page
                    </Typography>
                  </Flex>

                  <Typography variant="pi" textColor="neutral500">
                    {pagination.total} total results
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
      </Layouts.Content>

      {/* Modal */}
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
                Audit Log Details
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
                  <Typography paddingTop={2}>Loading log details...</Typography>
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
                        Action:
                      </Typography>
                      <Box
                        padding={1}
                        paddingLeft={2}
                        paddingRight={2}
                        hasRadius
                        style={getActionBadgeStyle(selectedLog.action)}
                      >
                        <Typography
                          variant="pi"
                          fontWeight="bold"
                          style={{ textTransform: "uppercase" }}
                        >
                          {selectedLog.action || "N/A"}
                        </Typography>
                      </Box>
                    </Flex>

                    <Flex justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="semiBold" textColor="neutral800">
                        Date:
                      </Typography>
                      <Typography variant="pi">
                        {(() => {
                          if (!selectedLog.date && !selectedLog.createdAt)
                            return "-";
                          const dateValue =
                            selectedLog.date || selectedLog.createdAt;
                          try {
                            const date = new Date(dateValue);
                            if (isNaN(date.getTime())) return dateValue;
                            return new Intl.DateTimeFormat("en-GB", {
                              dateStyle: "full",
                              timeStyle: "long",
                            }).format(date);
                          } catch {
                            return dateValue || "-";
                          }
                        })()}
                      </Typography>
                    </Flex>

                    <Flex justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="semiBold" textColor="neutral800">
                        User:
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
                          Endpoint:
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
                          Method:
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
                          Status:
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
                          IP Address:
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
                          User Agent:
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
                          Data:
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
                              const data =
                                selectedLog.payload || selectedLog.data;

                              // Filter out fields that are already displayed above
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
                                .reduce((obj, key) => {
                                  obj[key] = data[key];
                                  return obj;
                                }, {});

                              // If there's no unique data left, show a message
                              if (Object.keys(filteredData).length === 0) {
                                return "No additional data to display";
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
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </>
  );
};

export default HomePage;
