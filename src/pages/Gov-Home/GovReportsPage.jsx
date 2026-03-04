import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase";

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

function toNonNegativeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function hasPwdTag(person = {}) {
  const pwdId = String(person?.pwdId || "").trim().toUpperCase();
  if (pwdId && pwdId !== "N/A") {
    return true;
  }

  if (person?.hasDisability === true) {
    return true;
  }

  const disabilityType = String(person?.disabilityType || "").trim();
  return Boolean(disabilityType);
}

function getEventDate(value) {
  if (!value) return null;
  if (value?.toDate) {
    return value.toDate();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDateTime(value) {
  const parsed = getEventDate(value);
  if (!parsed) return "—";

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function GovReportsPage({
  stats,
  emergencyEvents = [],
  registeredUsers = [],
  evacuationCenters = [],
}) {
  const [auditLogs, setAuditLogs] = React.useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = React.useState(true);
  const [auditLogsError, setAuditLogsError] = React.useState("");

  React.useEffect(() => {
    const logsRef = collection(db, "scanLogs");
    const logsQuery = query(logsRef, orderBy("timestamp", "desc"), limit(60));

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const logs = [];
        snapshot.forEach((logDoc) => {
          const data = logDoc.data() || {};
          logs.push({
            id: logDoc.id,
            user: data.scannerEmail || data.scannerUid || "Unknown",
            action: data.eventType || "activity",
            time: data.timestamp || data.createdAt || null,
          });
        });
        setAuditLogs(logs);
        setAuditLogsError("");
        setAuditLogsLoading(false);
      },
      (error) => {
        console.error("Failed to load audit logs:", error);
        const errorCode = String(error?.code || "").toLowerCase();
        if (errorCode.includes("permission-denied")) {
          setAuditLogsError(
            "Access denied for access logs. Update Firestore rules to allow read access on scanLogs for government/admin accounts.",
          );
        } else {
          setAuditLogsError("Unable to load access logs.");
        }
        setAuditLogsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const residentUsers = React.useMemo(
    () =>
      registeredUsers.filter((user) => {
        const role = String(user?.role || "").toLowerCase();
        const accountType = String(user?.accountType || "").toLowerCase();
        return role !== "admin" && accountType !== "admin";
      }),
    [registeredUsers],
  );

  const sectorPopulation = React.useMemo(() => {
    const counts = {
      pwd: 0,
      elderly: 0,
      child: 0,
      family: 0,
      general: 0,
    };

    const applySectorCount = (person = {}) => {
      const age = getAge(person);
      if (hasPwdTag(person)) {
        counts.pwd += 1;
      } else if (Number.isFinite(age) && age >= 60) {
        counts.elderly += 1;
      } else if (Number.isFinite(age) && age < 18) {
        counts.child += 1;
      } else {
        counts.general += 1;
      }
    };

    residentUsers.forEach((user) => {
      const role = String(user?.role || "").toLowerCase();
      const userType = String(user?.userType || "").toLowerCase();
      const accountType = String(user?.accountType || "").toLowerCase();

      const isFamilyAccount =
        role === "family" ||
        userType === "family" ||
        accountType === "family" ||
        accountType === "residential-family";

      if (isFamilyAccount) {
        counts.family += 1;

        const familyProfile = user?.familyProfile || {};
        const listedMembers =
          Array.isArray(familyProfile.householdMembers) &&
          familyProfile.householdMembers.length > 0
            ? familyProfile.householdMembers
            : Array.isArray(user?.dependents) && user.dependents.length > 0
              ? user.dependents
              : [];

        if (listedMembers.length > 0) {
          listedMembers.forEach((member) => applySectorCount(member));

          const hasHeadInfo =
            Boolean(String(familyProfile.householdHead || "").trim()) ||
            Boolean(String(familyProfile.householdHeadDateOfBirth || "").trim()) ||
            Boolean(String(familyProfile.householdHeadDisabilityType || "").trim());

          if (hasHeadInfo) {
            applySectorCount({
              dateOfBirth: familyProfile.householdHeadDateOfBirth || "",
              disabilityType: familyProfile.householdHeadDisabilityType || "",
            });
          }
        } else {
          const declaredPwd = toNonNegativeNumber(familyProfile.pwdMembers);
          const declaredElderly = toNonNegativeNumber(familyProfile.elderlyMembers);
          const declaredChild = toNonNegativeNumber(familyProfile.childMembers);
          const declaredTotal = toNonNegativeNumber(familyProfile.totalMembers);
          const declaredVulnerable = declaredPwd + declaredElderly + declaredChild;
          const declaredGeneral = Math.max(0, declaredTotal - declaredVulnerable);

          if (declaredTotal > 0) {
            counts.pwd += declaredPwd;
            counts.elderly += declaredElderly;
            counts.child += declaredChild;
            counts.general += declaredGeneral;
          } else {
            applySectorCount(user);
          }
        }
      } else {
        applySectorCount(user);
      }
    });

    return counts;
  }, [residentUsers]);

  const sosCount = emergencyEvents.filter(
    (event) => event.type === "sos",
  ).length;

  const resolutionTimeMinutes = React.useMemo(() => {
    const results = [];

    emergencyEvents.forEach((event) => {
      if (event.type !== "sos") {
        return;
      }

      const start = getEventDate(event.createdAt || event.triggeredAt);
      const end = getEventDate(event.resolvedAt || event.updatedAt);

      if (!start || !end || end <= start) {
        return;
      }

      const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
      if (Number.isFinite(minutes) && minutes >= 0) {
        results.push(minutes);
      }
    });

    return results;
  }, [emergencyEvents]);

  const avgResolutionTime =
    resolutionTimeMinutes.length > 0
      ? Math.round(
          resolutionTimeMinutes.reduce((sum, value) => sum + value, 0) /
            resolutionTimeMinutes.length,
        )
      : null;

  const utilizationRows = React.useMemo(
    () =>
      evacuationCenters.map((center) => {
        const capacity = Number(center.capacity) || 0;
        const current = Number(center.current) || 0;
        const occupancyRate =
          capacity > 0 ? Math.round((current / capacity) * 100) : 0;
        return {
          id: center.id,
          name: center.name,
          capacity,
          current,
          occupancyRate,
        };
      }),
    [evacuationCenters],
  );

  const disasterTimeline = React.useMemo(() => {
    return [...emergencyEvents]
      .map((event) => {
        const timestamp =
          event.createdAt || event.triggeredAt || event.updatedAt;
        const date = getEventDate(timestamp);
        const action =
          event.type === "sos"
            ? "SOS Triggered"
            : event.type === "announcement"
              ? "Announcement Posted"
              : event.type === "resolution"
                ? "Incident Resolved"
                : "Activity Logged";

        return {
          id: event.id,
          event: action,
          user: event.userName || "Resident",
          timestamp,
          date,
        };
      })
      .filter((event) => event.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [emergencyEvents]);

  const handleExportCsv = () => {
    const rows = [
      ["Sector Population Report"],
      ["Sector", "Count"],
      ["PWD", sectorPopulation.pwd],
      ["Elderly", sectorPopulation.elderly],
      ["Child", sectorPopulation.child],
      ["Family Account", sectorPopulation.family],
      ["General", sectorPopulation.general],
      [],
      ["SOS Report"],
      ["Metric", "Value"],
      ["SOS Frequency", sosCount],
      ["Average Resolution Time (minutes)", avgResolutionTime ?? "N/A"],
      [],
      ["Evac Center Utilization"],
      ["Center", "Capacity", "Headcount", "Occupancy Rate (%)"],
      ...utilizationRows.map((row) => [
        row.name,
        row.capacity,
        row.current,
        row.occupancyRate,
      ]),
      [],
      ["Disaster Timeline"],
      ["Timestamp", "Event", "User"],
      ...disasterTimeline.map((item) => [
        formatDateTime(item.timestamp),
        item.event,
        item.user,
      ]),
      [],
      ["Audit Trail Export"],
      ["Time", "User", "Action"],
      ...auditLogs.map((log) => [
        formatDateTime(log.time),
        log.user,
        log.action,
      ]),
    ];

    downloadFile(
      `gov-reports-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows),
      "text/csv;charset=utf-8;",
    );
  };

  const handleExportPdf = () => {
    const reportHtml = `
      <html>
      <head>
        <title>Government Reports</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          h2 { margin-top: 24px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <h1>Government Reports</h1>

        <h2>Sector Population Report</h2>
        <table>
          <tr><th>Sector</th><th>Count</th></tr>
          <tr><td>PWD</td><td>${sectorPopulation.pwd}</td></tr>
          <tr><td>Elderly</td><td>${sectorPopulation.elderly}</td></tr>
          <tr><td>Child</td><td>${sectorPopulation.child}</td></tr>
          <tr><td>Family Account</td><td>${sectorPopulation.family}</td></tr>
          <tr><td>General</td><td>${sectorPopulation.general}</td></tr>
        </table>

        <h2>SOS Report</h2>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Frequency</td><td>${sosCount}</td></tr>
          <tr><td>Resolution Time (avg min)</td><td>${avgResolutionTime ?? "N/A"}</td></tr>
        </table>

        <h2>Evac Center Utilization</h2>
        <table>
          <tr><th>Center</th><th>Capacity</th><th>Headcount</th><th>Occupancy Rate</th></tr>
          ${utilizationRows
            .map(
              (row) =>
                `<tr><td>${row.name}</td><td>${row.capacity}</td><td>${row.current}</td><td>${row.occupancyRate}%</td></tr>`,
            )
            .join("")}
        </table>

        <h2>Disaster Timeline</h2>
        <table>
          <tr><th>Timestamp</th><th>Event</th><th>User</th></tr>
          ${disasterTimeline
            .map(
              (item) =>
                `<tr><td>${formatDateTime(item.timestamp)}</td><td>${item.event}</td><td>${item.user}</td></tr>`,
            )
            .join("")}
        </table>

        <h2>Audit Trail Export</h2>
        <table>
          <tr><th>User</th><th>Action</th><th>Time</th></tr>
          ${auditLogs
            .map(
              (log) =>
                `<tr><td>${log.user}</td><td>${log.action}</td><td>${formatDateTime(log.time)}</td></tr>`,
            )
            .join("")}
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <h3 className='text-xl font-black text-[#3a4a5b]'>Reports</h3>
        <p className='text-sm text-gray-500 mt-1'>
          Sector demographics, incident analytics, utilization, and export
          tools.
        </p>
        <div className='mt-4 flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={handleExportCsv}
            className='px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700'
          >
            Export CSV
          </button>
          <button
            type='button'
            onClick={handleExportPdf}
            className='px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800'
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white rounded-lg shadow-sm p-5 border border-gray-200'>
          <p className='text-xs font-bold text-gray-500 uppercase'>
            Total Residents
          </p>
          <p className='text-2xl font-black text-[#3a4a5b] mt-1'>
            {stats.totalRegistered}
          </p>
        </div>
        <div className='bg-white rounded-lg shadow-sm p-5 border border-gray-200'>
          <p className='text-xs font-bold text-gray-500 uppercase'>
            SOS Frequency
          </p>
          <p className='text-2xl font-black text-red-600 mt-1'>{sosCount}</p>
        </div>
        <div className='bg-white rounded-lg shadow-sm p-5 border border-gray-200'>
          <p className='text-xs font-bold text-gray-500 uppercase'>
            Avg Resolution
          </p>
          <p className='text-2xl font-black text-blue-600 mt-1'>
            {avgResolutionTime != null ? `${avgResolutionTime} min` : "N/A"}
          </p>
        </div>
        <div className='bg-white rounded-lg shadow-sm p-5 border border-gray-200'>
          <p className='text-xs font-bold text-gray-500 uppercase'>
            Audit Logs
          </p>
          <p className='text-2xl font-black text-[#3a4a5b] mt-1'>
            {auditLogs.length}
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
        <div className='xl:col-span-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
            Sector Population Report
          </h4>
          <p className='text-xs text-gray-500 mb-3'>
            Generate demographics count per sector
          </p>
          <div className='space-y-2'>
            {[
              ["PWD", sectorPopulation.pwd],
              ["Elderly", sectorPopulation.elderly],
              ["Child", sectorPopulation.child],
              ["Family Account", sectorPopulation.family],
              ["General", sectorPopulation.general],
            ].map(([label, count]) => (
              <div
                key={label}
                className='border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between'
              >
                <span className='text-sm text-gray-600'>{label}</span>
                <span className='text-sm font-bold text-[#3a4a5b]'>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className='xl:col-span-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
            SOS Report
          </h4>
          <p className='text-xs text-gray-500 mb-3'>
            Incident analytics: frequency and resolution time
          </p>
          <div className='space-y-2'>
            <div className='border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between'>
              <span className='text-sm text-gray-600'>Frequency</span>
              <span className='text-sm font-bold text-[#3a4a5b]'>
                {sosCount}
              </span>
            </div>
            <div className='border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between'>
              <span className='text-sm text-gray-600'>Resolution Time</span>
              <span className='text-sm font-bold text-[#3a4a5b]'>
                {avgResolutionTime != null ? `${avgResolutionTime} min` : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
          Evac Center Utilization
        </h4>
        <p className='text-xs text-gray-500 mb-3'>
          Capacity analytics and occupancy rate
        </p>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-[11px] font-black uppercase text-gray-500 border-b border-gray-200'>
                <th className='py-2 pr-2'>Center</th>
                <th className='py-2 pr-2'>Capacity</th>
                <th className='py-2 pr-2'>Headcount</th>
                <th className='py-2'>Occupancy Rate</th>
              </tr>
            </thead>
            <tbody>
              {utilizationRows.map((row) => (
                <tr key={`util-${row.id}`} className='border-b border-gray-100'>
                  <td className='py-2 pr-2 font-semibold text-[#3a4a5b]'>
                    {row.name}
                  </td>
                  <td className='py-2 pr-2 text-gray-700'>{row.capacity}</td>
                  <td className='py-2 pr-2 text-gray-700'>{row.current}</td>
                  <td className='py-2 text-gray-700'>{row.occupancyRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
        <div className='xl:col-span-7 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
            Disaster Timeline
          </h4>
          <p className='text-xs text-gray-500 mb-3'>
            Chronological logs with event timestamp
          </p>
          <div className='max-h-80 overflow-y-auto pr-1 space-y-2'>
            {disasterTimeline.length === 0 ? (
              <p className='text-sm text-gray-500'>
                No timeline events available.
              </p>
            ) : (
              disasterTimeline.map((item) => (
                <div
                  key={`timeline-${item.id}`}
                  className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                >
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Event:</span> {item.event}
                  </p>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>User:</span> {item.user}
                  </p>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Timestamp:</span>{" "}
                    {formatDateTime(item.timestamp)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='xl:col-span-5 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
            Audit Trail Export
          </h4>
          <p className='text-xs text-gray-500 mb-3'>
            Access logs: user, action, time
          </p>

          {auditLogsLoading ? (
            <div className='text-center py-8'>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className='text-gray-400 text-xl'
              />
            </div>
          ) : auditLogsError ? (
            <p className='text-sm text-red-600'>{auditLogsError}</p>
          ) : auditLogs.length === 0 ? (
            <p className='text-sm text-gray-500'>No access logs available.</p>
          ) : (
            <div className='space-y-2 max-h-80 overflow-y-auto pr-1'>
              {auditLogs.map((log) => (
                <div
                  key={`audit-${log.id}`}
                  className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                >
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>User:</span> {log.user}
                  </p>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Action:</span> {log.action}
                  </p>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Time:</span>{" "}
                    {formatDateTime(log.time)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

GovReportsPage.defaultProps = {
  stats: {
    totalRegistered: 0,
  },
  registeredUsers: [],
  evacuationCenters: [],
  emergencyEvents: [],
};

export default GovReportsPage;
