import React from "react";

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

function formatDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateInputStart(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDateInputEnd(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDateRange(date, startDate, endDate) {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function isWithinHighlightedCalendarRange(date, startDate, endDate) {
  if (!date || !startDate || !endDate) {
    return false;
  }

  return date >= startDate && date <= endDate;
}

function formatDateRangeLabel(startDateValue, endDateValue) {
  if (!startDateValue && !endDateValue) {
    return "All available dates";
  }

  if (startDateValue && endDateValue) {
    return `${startDateValue} to ${endDateValue}`;
  }

  if (startDateValue) {
    return `From ${startDateValue}`;
  }

  return `Until ${endDateValue}`;
}

function formatCalendarDateLabel(value) {
  const parsed = getDateInputStart(value);
  if (!parsed) return "";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameCalendarDay(left, right) {
  if (!left || !right) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getCalendarGrid(monthDate) {
  const monthStart = getMonthStart(monthDate);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    return {
      key: formatDateInputValue(cellDate),
      date: cellDate,
      isCurrentMonth: cellDate.getMonth() === monthDate.getMonth(),
    };
  });
}

function GovReportsPage({
  stats,
  emergencyEvents = [],
  registeredUsers = [],
  evacuationCenters = [],
}) {
  const [exportStartDate, setExportStartDate] = React.useState("");
  const [exportEndDate, setExportEndDate] = React.useState("");
  const [showDateRangePicker, setShowDateRangePicker] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(() =>
    getMonthStart(new Date()),
  );
  const dateRangePickerRef = React.useRef(null);

  const selectedStartDate = React.useMemo(
    () => getDateInputStart(exportStartDate),
    [exportStartDate],
  );
  const selectedEndDate = React.useMemo(
    () => getDateInputStart(exportEndDate),
    [exportEndDate],
  );

  React.useEffect(() => {
    if (!showDateRangePicker) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!dateRangePickerRef.current?.contains(event.target)) {
        setShowDateRangePicker(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showDateRangePicker]);

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
                : event.type === "evacuation-arrival"
                  ? event.status === "departed" || event.status === "cleared"
                    ? "Departure Confirmed"
                    : "Arrival Confirmed"
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

  const getFilteredExportData = React.useCallback(() => {
    const startDate = getDateInputStart(exportStartDate);
    const endDate = getDateInputEnd(exportEndDate);

    if (exportStartDate && !startDate) {
      alert("Please enter a valid start date.");
      return null;
    }

    if (exportEndDate && !endDate) {
      alert("Please enter a valid end date.");
      return null;
    }

    if (startDate && endDate && startDate > endDate) {
      alert("Start date must be on or before end date.");
      return null;
    }

    const filteredEvents = emergencyEvents.filter((event) => {
      const eventDate = getEventDate(
        event.createdAt || event.triggeredAt || event.updatedAt,
      );
      return isWithinDateRange(eventDate, startDate, endDate);
    });

    const filteredSosEvents = filteredEvents.filter(
      (event) => event.type === "sos",
    );

    const filteredResolutionMinutes = filteredSosEvents
      .map((event) => {
        const start = getEventDate(event.createdAt || event.triggeredAt);
        const end = getEventDate(event.resolvedAt || event.updatedAt);

        if (!start || !end || end <= start) {
          return null;
        }

        const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
        return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
      })
      .filter((value) => value != null);

    const filteredAvgResolutionTime =
      filteredResolutionMinutes.length > 0
        ? Math.round(
            filteredResolutionMinutes.reduce((sum, value) => sum + value, 0) /
              filteredResolutionMinutes.length,
          )
        : null;

    const filteredTimeline = filteredEvents
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
                : event.type === "evacuation-arrival"
                  ? event.status === "departed" || event.status === "cleared"
                    ? "Departure Confirmed"
                    : "Arrival Confirmed"
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

    return {
      filteredSosCount: filteredSosEvents.length,
      filteredAvgResolutionTime,
      filteredTimeline,
      rangeLabel: formatDateRangeLabel(exportStartDate, exportEndDate),
      filenameRange:
        exportStartDate || exportEndDate
          ? `${exportStartDate || "start"}_to_${exportEndDate || "end"}`
          : "all-dates",
    };
  }, [emergencyEvents, exportEndDate, exportStartDate]);

  const handleCalendarDateClick = React.useCallback((date) => {
    const nextValue = formatDateInputValue(date);

    if (!exportStartDate || (exportStartDate && exportEndDate)) {
      setExportStartDate(nextValue);
      setExportEndDate("");
      return;
    }

    if (nextValue < exportStartDate) {
      setExportStartDate(nextValue);
      setExportEndDate("");
      return;
    }

    setExportEndDate(nextValue);
    setShowDateRangePicker(false);
  }, [exportEndDate, exportStartDate]);

  const handleClearDateRange = React.useCallback(() => {
    setExportStartDate("");
    setExportEndDate("");
  }, []);

  const calendarMonths = React.useMemo(
    () => [calendarMonth, addMonths(calendarMonth, 1)],
    [calendarMonth],
  );

  const calendarRangeLabel = React.useMemo(() => {
    if (exportStartDate && exportEndDate) {
      return `${formatCalendarDateLabel(exportStartDate)} - ${formatCalendarDateLabel(exportEndDate)}`;
    }

    if (exportStartDate) {
      return `${formatCalendarDateLabel(exportStartDate)} - Select end date`;
    }

    return "Select date range";
  }, [exportEndDate, exportStartDate]);

  const handleExportCsv = () => {
    const filteredExportData = getFilteredExportData();
    if (!filteredExportData) {
      return;
    }

    const rows = [
      ["Report Date Range", filteredExportData.rangeLabel],
      [],
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
      ["SOS Frequency", filteredExportData.filteredSosCount],
      [
        "Average Resolution Time (minutes)",
        filteredExportData.filteredAvgResolutionTime ?? "N/A",
      ],
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
      ...filteredExportData.filteredTimeline.map((item) => [
        formatDateTime(item.timestamp),
        item.event,
        item.user,
      ]),
    ];

    downloadFile(
      `gov-reports-${filteredExportData.filenameRange}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows),
      "text/csv;charset=utf-8;",
    );
  };

  const handleExportPdf = () => {
    const filteredExportData = getFilteredExportData();
    if (!filteredExportData) {
      return;
    }

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
        <p><strong>Report Date Range:</strong> ${filteredExportData.rangeLabel}</p>

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
          <tr><td>Frequency</td><td>${filteredExportData.filteredSosCount}</td></tr>
          <tr><td>Resolution Time (avg min)</td><td>${filteredExportData.filteredAvgResolutionTime ?? "N/A"}</td></tr>
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
          ${filteredExportData.filteredTimeline
            .map(
              (item) =>
                `<tr><td>${formatDateTime(item.timestamp)}</td><td>${item.event}</td><td>${item.user}</td></tr>`,
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
        <div className='mt-4 grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_auto_auto] gap-3 items-end'>
          <div className='relative' ref={dateRangePickerRef}>
            <span className='text-[11px] font-bold uppercase text-gray-500'>
              Export Date Range
            </span>
            <button
              type='button'
              onClick={() => setShowDateRangePicker((current) => !current)}
              className='mt-1 flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:border-blue-400 focus:border-blue-500 focus:outline-none'
            >
              <span>{calendarRangeLabel}</span>
              <span className='text-xs font-bold uppercase text-blue-600'>
                Calendar
              </span>
            </button>

            {showDateRangePicker ? (
              <div className='absolute left-0 top-full z-20 mt-2 w-[min(44rem,92vw)] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <p className='text-sm font-bold text-[#3a4a5b]'>
                      Select export range
                    </p>
                    <p className='text-xs text-gray-500'>
                      Click a start date, then click an end date to highlight the range.
                    </p>
                  </div>
                  <div className='flex gap-2'>
                    <button
                      type='button'
                      onClick={handleClearDateRange}
                      className='rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-800'
                    >
                      Clear
                    </button>
                    <button
                      type='button'
                      onClick={() => setShowDateRangePicker(false)}
                      className='rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900'
                    >
                      Done
                    </button>
                  </div>
                </div>

                <div className='mt-4 flex items-center justify-between'>
                  <button
                    type='button'
                    onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                    className='rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-800'
                  >
                    Previous
                  </button>
                  <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-500'>
                    Highlighted range
                  </p>
                  <button
                    type='button'
                    onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                    className='rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-800'
                  >
                    Next
                  </button>
                </div>

                <div className='mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2'>
                  {calendarMonths.map((monthDate) => {
                    const monthLabel = monthDate.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    });

                    return (
                      <div key={monthLabel} className='rounded-xl border border-gray-200 p-3'>
                        <p className='mb-3 text-sm font-bold text-[#3a4a5b]'>
                          {monthLabel}
                        </p>
                        <div className='mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-gray-400'>
                          {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ].map((dayLabel) => (
                            <span key={dayLabel}>{dayLabel}</span>
                          ))}
                        </div>
                        <div className='grid grid-cols-7 gap-x-0 gap-y-1'>
                          {getCalendarGrid(monthDate).map((cell) => {
                            const isStart = isSameCalendarDay(cell.date, selectedStartDate);
                            const isEnd = isSameCalendarDay(cell.date, selectedEndDate);
                            const isInRange = isWithinHighlightedCalendarRange(
                              cell.date,
                              selectedStartDate,
                              selectedEndDate,
                            );
                            const isSingleDayRange = isStart && isEnd;

                            const cellClassName = [
                              "flex h-10 w-full items-center justify-center text-sm font-semibold transition-colors",
                              cell.isCurrentMonth
                                ? "text-gray-700"
                                : "text-gray-300",
                              isInRange
                                ? "bg-blue-600 text-white"
                                : "hover:bg-gray-100",
                              isSingleDayRange
                                ? "rounded-lg bg-blue-600 text-white hover:bg-blue-600"
                                : isStart
                                  ? "rounded-l-lg rounded-r-none bg-blue-600 text-white hover:bg-blue-600"
                                  : isEnd
                                    ? "rounded-r-lg rounded-l-none bg-blue-600 text-white hover:bg-blue-600"
                                    : isInRange
                                      ? "rounded-none"
                                      : "rounded-lg",
                            ]
                              .filter(Boolean)
                              .join(" ");

                            return (
                              <button
                                key={cell.key}
                                type='button'
                                onClick={() => handleCalendarDateClick(cell.date)}
                                className={cellClassName}
                              >
                                {cell.date.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type='button'
            onClick={handleExportCsv}
            className='px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 h-10'
          >
            Export CSV
          </button>
          <button
            type='button'
            onClick={handleExportPdf}
            className='px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 h-10'
          >
            Export PDF
          </button>
        </div>
        <p className='mt-3 text-xs text-gray-500'>
          Date range filters event-based export data. Leave both dates empty to
          export all available records.
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
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
        <div className='xl:col-span-12 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
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
