import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

function getAge(user) {
  const numericAge = Number(user?.age);
  if (Number.isFinite(numericAge) && numericAge >= 0) {
    return numericAge;
  }

  const birthday = user?.dateOfBirth || user?.birthDate || user?.dob;
  if (!birthday) return null;

  const parsed = new Date(birthday);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function hasMobilityFlag(user) {
  const mobilityHints = [
    user?.mobilityFlag,
    user?.mobilityNeeds,
    user?.wheelchairRequired,
    user?.disabilityNotes,
    user?.accessibilityNeeds,
  ];

  return mobilityHints.some((value) => {
    const normalized = String(value || "").toLowerCase();
    return (
      normalized.includes("mobility") ||
      normalized.includes("wheelchair") ||
      normalized.includes("walker")
    );
  });
}

function hasMedicalFlag(user) {
  const medicalHints = [
    user?.medicalFlag,
    user?.medicalInfo,
    user?.medicalConditions,
    user?.maintenanceMedication,
    user?.allergies,
  ];

  return medicalHints.some((value) => String(value || "").trim().length > 0);
}

function getSectorGroup(user) {
  const age = getAge(user);
  if (user?.pwdId && user?.pwdId !== "N/A") {
    return "pwd";
  }
  if (Number.isFinite(age) && age >= 60) {
    return "elderly";
  }
  if (Number.isFinite(age) && age < 18) {
    return "child";
  }

  return "general";
}

function getAccountTypeGroup(user) {
  const accountType = String(user?.accountType || "").toLowerCase();
  const role = String(user?.role || "").toLowerCase();

  if (accountType.includes("family") || role.includes("family")) {
    return "family";
  }

  if (
    user?.familyProfile ||
    (Array.isArray(user?.householdMembers) && user.householdMembers.length > 0)
  ) {
    return "family";
  }

  return "individual";
}

function getConsentStatus(user) {
  if (typeof user?.trackingConsent === "boolean") {
    return user.trackingConsent ? "Granted" : "Declined";
  }
  if (typeof user?.consentStatus === "string" && user.consentStatus.trim()) {
    return user.consentStatus;
  }
  if (typeof user?.locationSharingConsent === "boolean") {
    return user.locationSharingConsent ? "Granted" : "Declined";
  }

  return "Unknown";
}

function getBeaconStatus(user) {
  if (typeof user?.beaconOnline === "boolean") {
    return user.beaconOnline ? "Online" : "Offline";
  }
  if (typeof user?.deviceOnline === "boolean") {
    return user.deviceOnline ? "Online" : "Offline";
  }
  if (typeof user?.isOnline === "boolean") {
    return user.isOnline ? "Online" : "Offline";
  }
  if (typeof user?.beaconStatus === "string" && user.beaconStatus.trim()) {
    return user.beaconStatus;
  }

  return "Unknown";
}

function getLastSyncLabel(user) {
  const rawSync =
    user?.lastSyncAt ||
    user?.beaconLastSync ||
    user?.deviceLastSeen ||
    user?.updatedAt;

  if (!rawSync) return "No sync data";

  const parsed = rawSync?.toDate ? rawSync.toDate() : new Date(rawSync);
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return "No sync data";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function GovRegisteredUsersPage({
  filteredUsers = [],
  loading = false,
  searchTerm = "",
  filterStatus = "all",
  onSearch,
  onFilterChange,
}) {
  const [sectorFilter, setSectorFilter] = React.useState("all");
  const [qrQuery, setQrQuery] = React.useState("");
  const [qrResult, setQrResult] = React.useState(null);
  const [qrError, setQrError] = React.useState("");
  const [qrAuditStatus, setQrAuditStatus] = React.useState("");
  const [qrAuditLogs, setQrAuditLogs] = React.useState([]);
  const [qrAuditLoading, setQrAuditLoading] = React.useState(true);
  const [qrAuditError, setQrAuditError] = React.useState("");
  const [qrAuditDateFilter, setQrAuditDateFilter] = React.useState("all");
  const [qrAuditAuthorizedOnly, setQrAuditAuthorizedOnly] =
    React.useState(false);
  const [authorizedMedicalAccess, setAuthorizedMedicalAccess] =
    React.useState(false);

  const residentOnlyUsers = React.useMemo(
    () =>
      filteredUsers.filter((user) => {
        const role = String(user?.role || "").toLowerCase();
        const accountType = String(user?.accountType || "").toLowerCase();
        return role !== "admin" && accountType !== "admin";
      }),
    [filteredUsers],
  );

  const accountTypeFilteredUsers = React.useMemo(() => {
    if (filterStatus === "family" || filterStatus === "individual") {
      return residentOnlyUsers.filter(
        (user) => getAccountTypeGroup(user) === filterStatus,
      );
    }

    return residentOnlyUsers;
  }, [filterStatus, residentOnlyUsers]);

  React.useEffect(() => {
    const scanLogsRef = collection(db, "scanLogs");
    const logsQuery = query(
      scanLogsRef,
      orderBy("timestamp", "desc"),
      limit(25),
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const logs = [];
        snapshot.forEach((logDoc) => {
          const data = logDoc.data() || {};
          if (data.eventType !== "gov_qr_lookup") {
            return;
          }

          logs.push({
            id: logDoc.id,
            scannerEmail: data.scannerEmail || "Unknown",
            residentName: data.residentName || "Unknown User",
            medicalAccessAuthorized: Boolean(data.medicalAccessAuthorized),
            timestamp: data.timestamp,
          });
        });

        setQrAuditLogs(logs);
        setQrAuditError("");
        setQrAuditLoading(false);
      },
      (error) => {
        console.error("Failed to load QR access audit logs:", error);
        setQrAuditError("Unable to load QR access logs.");
        setQrAuditLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const sectorFilteredUsers = React.useMemo(() => {
    if (sectorFilter === "all") {
      return accountTypeFilteredUsers;
    }

    return accountTypeFilteredUsers.filter(
      (user) => getSectorGroup(user) === sectorFilter,
    );
  }, [accountTypeFilteredUsers, sectorFilter]);

  const filteredQrAuditLogs = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return qrAuditLogs.filter((log) => {
      if (qrAuditAuthorizedOnly && !log.medicalAccessAuthorized) {
        return false;
      }

      if (qrAuditDateFilter === "all") {
        return true;
      }

      const logDate = log.timestamp?.toDate
        ? log.timestamp.toDate()
        : log.timestamp
          ? new Date(log.timestamp)
          : null;

      if (!(logDate instanceof Date) || Number.isNaN(logDate.getTime())) {
        return false;
      }

      if (qrAuditDateFilter === "today") {
        return logDate >= startOfToday;
      }

      if (qrAuditDateFilter === "last7") {
        return logDate >= sevenDaysAgo;
      }

      return true;
    });
  }, [qrAuditAuthorizedOnly, qrAuditDateFilter, qrAuditLogs]);

  const familyGroups = React.useMemo(() => {
    const grouped = new Map();

    sectorFilteredUsers.forEach((user) => {
      const familyName =
        user.familyName ||
        user.householdName ||
        user.lastName ||
        "Unassigned Family";

      if (!grouped.has(familyName)) {
        grouped.set(familyName, []);
      }

      grouped.get(familyName).push(user);
    });

    return Array.from(grouped.entries())
      .map(([familyName, members]) => ({ familyName, members }))
      .sort((a, b) => b.members.length - a.members.length);
  }, [sectorFilteredUsers]);

  const logQrAccessAudit = React.useCallback(
    async ({ matchedUser, lookupValue }) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !matchedUser) {
        return;
      }

      await addDoc(collection(db, "scanLogs"), {
        eventType: "gov_qr_lookup",
        scannerUid: currentUser.uid,
        scannerEmail: currentUser.email || "",
        scannerRole: "government",
        residentUid: matchedUser.uid || matchedUser.id || "",
        residentName: matchedUser.fullName || "Unknown User",
        residentEmail: matchedUser.email || "",
        qrLookupValue: lookupValue,
        medicalAccessAuthorized: Boolean(authorizedMedicalAccess),
        timestamp: serverTimestamp(),
      });
    },
    [authorizedMedicalAccess],
  );

  const handleQrLookup = async () => {
    const normalized = qrQuery.trim().toLowerCase();
    setQrAuditStatus("");

    if (!normalized) {
      setQrResult(null);
      setQrError("Enter QR value, user ID, or email.");
      return;
    }

    const matchedUser = residentOnlyUsers.find((user) => {
      const qrCode = String(user.profileQrCode || "").toLowerCase();
      const uid = String(user.uid || user.id || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      return (
        qrCode === normalized || uid === normalized || email === normalized
      );
    });

    if (!matchedUser) {
      setQrResult(null);
      setQrError("No resident matched that scan value.");
      return;
    }

    setQrResult(matchedUser);
    setQrError("");

    try {
      await logQrAccessAudit({
        matchedUser,
        lookupValue: normalized,
      });
      setQrAuditStatus("Access log recorded.");
    } catch (error) {
      console.error("Failed to save QR access audit log:", error);
      setQrAuditStatus("Lookup shown, but failed to save access log.");
    }
  };

  const formatAuditTime = (rawTimestamp) => {
    const parsed = rawTimestamp?.toDate
      ? rawTimestamp.toDate()
      : rawTimestamp
        ? new Date(rawTimestamp)
        : null;

    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
          <div>
            <h3 className='text-xl font-black text-[#3a4a5b]'>
              Registered Users
            </h3>
            <p className='text-sm text-gray-500 mt-1'>
              Resident directory view for validation and planning.
            </p>
          </div>
          <div className='flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto'>
            <input
              type='text'
              placeholder='Search user...'
              value={searchTerm}
              onChange={onSearch}
              className='w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
            <select
              value={filterStatus}
              onChange={onFilterChange}
              className='px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='all'>All</option>
              <option value='family'>Families</option>
              <option value='individual'>Individual</option>
              <option value='pwd'>PWD</option>
            </select>
            <select
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
              className='px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='all'>Sector: All</option>
              <option value='pwd'>Sector: PWD</option>
              <option value='elderly'>Sector: Elderly</option>
              <option value='child'>Sector: Child</option>
            </select>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
        <div className='xl:col-span-7 bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
          <div className='flex items-center justify-between mb-3'>
            <h4 className='text-sm font-black text-[#3a4a5b] uppercase'>
              Resident List (Family Grouped)
            </h4>
            <span className='text-xs text-gray-500'>
              Population: {sectorFilteredUsers.length}
            </span>
          </div>

          {loading ? (
            <div className='text-center py-8'>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className='text-gray-400 text-xl'
              />
            </div>
          ) : familyGroups.length === 0 ? (
            <p className='text-sm text-gray-500 text-center py-8'>
              No residents found for this filter.
            </p>
          ) : (
            <div className='space-y-3 max-h-120 overflow-y-auto pr-1'>
              {familyGroups.map((group) => (
                <div
                  key={group.familyName}
                  className='rounded-lg border border-gray-200 bg-gray-50 p-3'
                >
                  <div className='flex items-center justify-between mb-2'>
                    <p className='text-sm font-black text-[#3a4a5b]'>
                      {group.familyName}
                    </p>
                    <span className='text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full'>
                      Members: {group.members.length}
                    </span>
                  </div>

                  <div className='space-y-2'>
                    {group.members.map((user) => {
                      const consentStatus = getConsentStatus(user);
                      const beaconStatus = getBeaconStatus(user);
                      const mobilityFlag = hasMobilityFlag(user);
                      const medicalFlag = hasMedicalFlag(user);
                      const accountTypeLabel =
                        user.accountType || user.role || "Resident";

                      return (
                        <div
                          key={user.id}
                          className='rounded-md bg-white border border-gray-200 px-3 py-2'
                        >
                          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-2'>
                            <div className='min-w-0'>
                              <p className='text-sm font-bold text-[#3a4a5b] truncate'>
                                {user.fullName || "Unknown User"}
                              </p>
                              <p className='text-xs text-gray-500 truncate'>
                                {user.email || "No email"}
                              </p>
                              <p className='text-xs text-gray-500 truncate'>
                                Account Type: {accountTypeLabel}
                              </p>
                            </div>
                            <div className='flex flex-wrap items-center gap-1.5'>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  consentStatus.toLowerCase().includes("grant")
                                    ? "bg-green-100 text-green-700"
                                    : consentStatus
                                          .toLowerCase()
                                          .includes("declin")
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                Consent: {consentStatus}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  String(beaconStatus)
                                    .toLowerCase()
                                    .includes("online")
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                Beacon: {beaconStatus}
                              </span>
                              {mobilityFlag && (
                                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700'>
                                  Mobility Flag
                                </span>
                              )}
                              {medicalFlag && (
                                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700'>
                                  Medical Flag
                                </span>
                              )}
                            </div>
                          </div>
                          <p className='text-[11px] text-gray-500 mt-1'>
                            Last Sync: {getLastSyncLabel(user)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='xl:col-span-5 space-y-6'>
          <div className='bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
            <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
              QR-Based Access
            </h4>
            <p className='text-xs text-gray-500 mb-3'>
              View profile via scan (Identity + Medical Authorized Only)
            </p>

            <div className='space-y-2'>
              <input
                type='text'
                value={qrQuery}
                onChange={(event) => setQrQuery(event.target.value)}
                placeholder='Scan value / QR / UID / email'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
              />
              <button
                type='button'
                onClick={handleQrLookup}
                className='w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
              >
                Lookup Profile
              </button>
              <label className='flex items-center gap-2 text-xs text-gray-600'>
                <input
                  type='checkbox'
                  checked={authorizedMedicalAccess}
                  onChange={(event) =>
                    setAuthorizedMedicalAccess(event.target.checked)
                  }
                />
                Authorized to view medical data
              </label>
            </div>

            {qrError && <p className='text-xs text-red-600 mt-2'>{qrError}</p>}
            {qrAuditStatus && (
              <p
                className={`text-xs mt-2 ${
                  qrAuditStatus.toLowerCase().includes("failed") ||
                  qrAuditStatus.toLowerCase().includes("but")
                    ? "text-orange-600"
                    : "text-green-600"
                }`}
              >
                {qrAuditStatus}
              </p>
            )}

            {qrResult && (
              <div className='mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1'>
                <p className='text-xs text-gray-700'>
                  <span className='font-bold'>Identity:</span>{" "}
                  {qrResult.fullName || "Unknown User"}
                </p>
                <p className='text-xs text-gray-700'>
                  <span className='font-bold'>Contact:</span>{" "}
                  {qrResult.contact ||
                    qrResult.phone ||
                    qrResult.emergencyContactNumber ||
                    "Not provided"}
                </p>
                <p className='text-xs text-gray-700'>
                  <span className='font-bold'>Medical:</span>{" "}
                  {authorizedMedicalAccess
                    ? qrResult.medicalInfo ||
                      qrResult.medicalConditions ||
                      (qrResult.bloodType
                        ? `Blood Type: ${qrResult.bloodType}`
                        : "No medical record")
                    : "Hidden (authorization required)"}
                </p>
              </div>
            )}
          </div>

          <div className='bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
            <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
              Sector Snapshot
            </h4>
            <div className='space-y-2 text-sm'>
              <div className='flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2'>
                <span className='text-gray-600'>PWD</span>
                <span className='font-bold text-[#3a4a5b]'>
                  {
                    residentOnlyUsers.filter(
                      (user) => getSectorGroup(user) === "pwd",
                    ).length
                  }
                </span>
              </div>
              <div className='flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2'>
                <span className='text-gray-600'>Elderly</span>
                <span className='font-bold text-[#3a4a5b]'>
                  {
                    residentOnlyUsers.filter(
                      (user) => getSectorGroup(user) === "elderly",
                    ).length
                  }
                </span>
              </div>
              <div className='flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2'>
                <span className='text-gray-600'>Child</span>
                <span className='font-bold text-[#3a4a5b]'>
                  {
                    residentOnlyUsers.filter(
                      (user) => getSectorGroup(user) === "child",
                    ).length
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
        <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
          Consent & Beacon Monitoring
        </h4>

        {loading ? (
          <div className='text-center py-8'>
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className='text-gray-400 text-xl'
            />
          </div>
        ) : sectorFilteredUsers.length === 0 ? (
          <p className='text-sm text-gray-500 text-center py-8'>
            No users found for this filter.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] font-black uppercase text-gray-500 border-b border-gray-200'>
                  <th className='py-2 pr-2'>Resident</th>
                  <th className='py-2 pr-2'>Consent Status</th>
                  <th className='py-2 pr-2'>Beacon Status</th>
                  <th className='py-2 pr-2'>Last Sync</th>
                  <th className='py-2'>Priority Flags</th>
                </tr>
              </thead>
              <tbody>
                {sectorFilteredUsers.slice(0, 16).map((user) => {
                  const consentStatus = getConsentStatus(user);
                  const beaconStatus = getBeaconStatus(user);
                  const mobilityFlag = hasMobilityFlag(user);
                  const medicalFlag = hasMedicalFlag(user);
                  return (
                    <tr
                      key={`monitor-${user.id}`}
                      className='border-b border-gray-100'
                    >
                      <td className='py-2 pr-2 font-semibold text-[#3a4a5b]'>
                        {user.fullName || "Unknown User"}
                      </td>
                      <td className='py-2 pr-2 text-gray-700'>
                        {consentStatus}
                      </td>
                      <td className='py-2 pr-2 text-gray-700'>
                        {beaconStatus}
                      </td>
                      <td className='py-2 pr-2 text-gray-700'>
                        {getLastSyncLabel(user)}
                      </td>
                      <td className='py-2'>
                        <div className='flex flex-wrap gap-1'>
                          {mobilityFlag && (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700'>
                              Mobility
                            </span>
                          )}
                          {medicalFlag && (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700'>
                              Medical
                            </span>
                          )}
                          {!mobilityFlag && !medicalFlag && (
                            <span className='text-xs text-gray-500'>None</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className='bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
        <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
          QR Access Audit
        </h4>

        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3'>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setQrAuditDateFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                qrAuditDateFilter === "all"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              All
            </button>
            <button
              type='button'
              onClick={() => setQrAuditDateFilter("today")}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                qrAuditDateFilter === "today"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              Today
            </button>
            <button
              type='button'
              onClick={() => setQrAuditDateFilter("last7")}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                qrAuditDateFilter === "last7"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              Last 7 Days
            </button>
          </div>
          <label className='flex items-center gap-2 text-xs text-gray-600'>
            <input
              type='checkbox'
              checked={qrAuditAuthorizedOnly}
              onChange={(event) =>
                setQrAuditAuthorizedOnly(event.target.checked)
              }
            />
            Authorized-only
          </label>
        </div>

        {qrAuditLoading ? (
          <div className='text-center py-6'>
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className='text-gray-400 text-lg'
            />
          </div>
        ) : qrAuditError ? (
          <p className='text-sm text-red-600'>{qrAuditError}</p>
        ) : filteredQrAuditLogs.length === 0 ? (
          <p className='text-sm text-gray-500'>No QR access logs yet.</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] font-black uppercase text-gray-500 border-b border-gray-200'>
                  <th className='py-2 pr-2'>Timestamp</th>
                  <th className='py-2 pr-2'>Scanner</th>
                  <th className='py-2 pr-2'>Resident</th>
                  <th className='py-2'>Medical Access</th>
                </tr>
              </thead>
              <tbody>
                {filteredQrAuditLogs.map((log) => (
                  <tr key={log.id} className='border-b border-gray-100'>
                    <td className='py-2 pr-2 text-gray-700'>
                      {formatAuditTime(log.timestamp)}
                    </td>
                    <td className='py-2 pr-2 text-gray-700'>
                      {log.scannerEmail}
                    </td>
                    <td className='py-2 pr-2 font-semibold text-[#3a4a5b]'>
                      {log.residentName}
                    </td>
                    <td className='py-2'>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          log.medicalAccessAuthorized
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {log.medicalAccessAuthorized
                          ? "Authorized"
                          : "Not Authorized"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default GovRegisteredUsersPage;
