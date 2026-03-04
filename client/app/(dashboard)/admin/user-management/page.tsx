"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { User as UserAvatar } from "@heroui/user";
import { api } from "@/lib/api/client";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@heroui/spinner";
import { User } from "@/hooks/use-auth";
import { Pagination } from "@heroui/pagination";
import { SearchIcon } from "@/components/icons";
import { addToast } from "@heroui/toast";
import { useTranslations } from "next-intl";

interface InvitationCode {
  code: string;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const tAdmin = useTranslations("admin");
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const {
    isOpen: isInviteOpen,
    onOpen: onInviteOpen,
    onOpenChange: onInviteOpenChange,
  } = useDisclosure();
  const [inviteEmails, setInviteEmails] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);

  const {
    isOpen: isCodeOpen,
    onOpen: onCodeOpen,
    onOpenChange: onCodeOpenChange,
  } = useDisclosure();
  const [codeCount, setCodeCount] = useState("1");
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<InvitationCode[]>([]);

  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onOpenChange: onEditOpenChange,
    onClose: onEditClose,
  } = useDisclosure();
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    roles: [] as string[],
  });
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (user && user.roles.includes("admin")) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const data = await api.get("/api/admin/users");
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let filteredUsers = [...users];
    if (filterValue) {
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.email.toLowerCase().includes(filterValue.toLowerCase()) ||
          (user.firstName &&
            user.firstName.toLowerCase().includes(filterValue.toLowerCase())) ||
          (user.lastName &&
            user.lastName.toLowerCase().includes(filterValue.toLowerCase()))
      );
    }
    return filteredUsers;
  }, [users, filterValue]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  const onSearchChange = useCallback((value?: string) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const handleSendInvites = async () => {
    setSendingInvites(true);
    try {
      const emails = inviteEmails
        .split(/[\n, ]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      const response = await api.post("/api/admin/invite-email", { emails });
      addToast({
        title: tCommon("success"),
        description: t("inviteSuccess", { count: response.count }),
        color: "success",
      });
      setInviteEmails("");
    } catch (error) {
      addToast({
        title: tCommon("error"),
        description: error instanceof Error ? error.message : t("inviteError"),
        color: "danger",
      });
    } finally {
      setSendingInvites(false);
    }
  };

  const handleGenerateCodes = async () => {
    setGeneratingCodes(true);
    try {
      const response = await api.post("/api/admin/invitation-codes", {
        count: parseInt(codeCount),
      });
      setGeneratedCodes(response.codes);
      addToast({
        title: tCommon("success"),
        description: t("generateSuccess"),
        color: "success",
      });
    } catch (error) {
      console.error("Failed to generate codes:", error);
      addToast({
        title: tCommon("error"),
        description: t("generateError"),
        color: "danger",
      });
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleEditUser = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    setEditFormData({
      firstName: userToEdit.firstName || "",
      lastName: userToEdit.lastName || "",
      roles: userToEdit.roles,
    });
    onEditOpen();
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    try {
      await api.patch(`/api/admin/users/${selectedUser.id}`, {
        firstName: editFormData.firstName || null,
        lastName: editFormData.lastName || null,
        roles: editFormData.roles,
      });
      await fetchUsers();
      onEditClose();
      addToast({
        title: tCommon("success"),
        description: t("updateSuccess"),
        color: "success",
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      addToast({
        title: tCommon("error"),
        description: t("updateError"),
        color: "danger",
      });
    } finally {
      setSavingUser(false);
    }
  };

  if (authLoading) {
    return <Spinner size="lg" className="flex justify-center mt-10" />;
  }

  if (!user || !user.roles.includes("admin")) {
    return <div className="p-8 text-center">{tAdmin("unauthorized")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 sm:gap-0">
        <h1 className="text-2xl font-bold">{t("managementTitle")}</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button color="primary" variant="flat" onPress={onCodeOpen} className="w-full sm:w-auto">
            {t("generateCodes")}
          </Button>
          <Button color="primary" onPress={onInviteOpen} className="w-full sm:w-auto">
            {t("inviteUsers")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-3 items-end">
              <Input
                isClearable
                className="w-full sm:max-w-[44%]"
                placeholder={t("searchPlaceholder")}
                startContent={<SearchIcon />}
                value={filterValue}
                onClear={() => onClear()}
                onValueChange={onSearchChange}
              />
            </div>
            <Table
              aria-label="User table"
              bottomContent={
                pages > 0 ? (
                  <div className="flex w-full justify-center">
                    <Pagination
                      isCompact
                      showControls
                      showShadow
                      color="primary"
                      page={page}
                      total={pages}
                      onChange={(page) => setPage(page)}
                    />
                  </div>
                ) : null
              }
            >
              <TableHeader>
                <TableColumn>{t("userColumn")}</TableColumn>
                <TableColumn>{t("rolesColumn")}</TableColumn>
                <TableColumn>{t("providerColumn")}</TableColumn>
                <TableColumn>{t("joinedColumn")}</TableColumn>
                <TableColumn>{t("actionsColumn")}</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={loading ? <Spinner /> : t("noUsersFound")}
                items={items}
              >
                {(item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <UserAvatar
                        name={
                          item.firstName && item.lastName
                            ? `${item.firstName} ${item.lastName}`
                            : item.firstName || item.email
                        }
                        description={item.email}
                        avatarProps={{
                          name: (
                            item.firstName?.charAt(0) || item.email.charAt(0)
                          ).toUpperCase(),
                          color: "primary",
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.roles.map((role) => (
                          <Chip
                            key={role}
                            size="sm"
                            variant="flat"
                            color={
                              role === "admin"
                                ? "danger"
                                : role === "new_user"
                                  ? "warning"
                                  : "primary"
                            }
                          >
                            {role}
                          </Chip>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{item.authProvider}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="flat" onPress={() => handleEditUser(item)}>
                        {t("editButton")}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* Email Invite Modal */}
      <Modal isOpen={isInviteOpen} onOpenChange={onInviteOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("inviteModal")}</ModalHeader>
              <ModalBody>
                <p className="text-sm text-gray-500">{t("inviteDescription")}</p>
                <Textarea
                  label={t("emailsLabel")}
                  placeholder={t("emailsPlaceholder")}
                  minRows={4}
                  value={inviteEmails}
                  onValueChange={setInviteEmails}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>{tCommon("close")}</Button>
                <Button
                  color="primary"
                  onPress={handleSendInvites}
                  isLoading={sendingInvites}
                  isDisabled={!inviteEmails.trim()}
                >
                  {t("sendInvites")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Generate Codes Modal */}
      <Modal isOpen={isCodeOpen} onOpenChange={onCodeOpenChange} size="lg" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("generateCodesModal")}</ModalHeader>
              <ModalBody>
                <div className="flex items-end gap-4 mb-4">
                  <Input
                    type="number"
                    label={t("numberOfCodes")}
                    value={codeCount}
                    onValueChange={setCodeCount}
                    min={1}
                    max={100}
                  />
                  <Button color="primary" onPress={handleGenerateCodes} isLoading={generatingCodes}>
                    {t("generateButton")}
                  </Button>
                </div>

                {generatedCodes.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{t("generatedCodesLabel")}</span>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => {
                          const text = generatedCodes.map((c) => c.code).join("\n");
                          navigator.clipboard.writeText(text);
                          addToast({ title: t("copiedToClipboard"), color: "default" });
                        }}
                      >
                        {t("copyAll")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                      {generatedCodes.map((code) => (
                        <div
                          key={code.code}
                          className="p-2 bg-white dark:bg-gray-800 border rounded text-center font-mono text-lg tracking-wider"
                        >
                          {code.code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button onPress={onClose}>{t("done")}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={isEditOpen} onOpenChange={onEditOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("editUserModal")}</ModalHeader>
              <ModalBody>
                <div className="flex gap-4">
                  <Input
                    label={t("firstNameLabel")}
                    value={editFormData.firstName}
                    onValueChange={(v) => setEditFormData({ ...editFormData, firstName: v })}
                  />
                  <Input
                    label={t("lastNameLabel")}
                    value={editFormData.lastName}
                    onValueChange={(v) => setEditFormData({ ...editFormData, lastName: v })}
                  />
                </div>
                <Select
                  label={t("rolesLabel")}
                  selectionMode="multiple"
                  selectedKeys={new Set(editFormData.roles)}
                  onSelectionChange={(keys) =>
                    setEditFormData({ ...editFormData, roles: Array.from(keys) as string[] })
                  }
                >
                  <SelectItem key="user">{t("roleUser")}</SelectItem>
                  <SelectItem key="admin">{t("roleAdmin")}</SelectItem>
                  <SelectItem key="new_user">{t("roleNewUser")}</SelectItem>
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>{tCommon("cancel")}</Button>
                <Button color="primary" onPress={handleSaveUser} isLoading={savingUser}>
                  {t("saveUserButton")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
