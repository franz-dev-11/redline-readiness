import React from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

function normalizeCenterKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getFamilyMemberRows(user) {
  const familyProfile = user?.familyProfile || {};
  const headName = String(
    familyProfile.householdHead || user?.fullName || "Family Head",
  ).trim();
  const members = Array.isArray(familyProfile.householdMembers)
    ? familyProfile.householdMembers
    : [];

  const rows = [{ id: "head", name: headName, relationship: "Head" }];

  members.forEach((member, index) => {
    const memberName = String(member?.name || "").trim();
    const relationship = String(member?.relationship || "Member").trim();
    if (!memberName) {
      return;
    }
    rows.push({
      id: `member-${index}`,
      name: memberName,
      relationship: relationship || "Member",
    });
  });

  return rows;
}

function GovEvacuationPlansPage({ evacuationCenters = [] }) {
  const [uploadedPlans, setUploadedPlans] = React.useState([]);
  const [planFile, setPlanFile] = React.useState(null);
  const planFileInputRef = React.useRef(null);

  const [centers, setCenters] = React.useState([]);
  const [centerDraft, setCenterDraft] = React.useState({
    id: null,
    name: "",
    address: "",
    capacity: "",
  });

  const [familyAssignments, setFamilyAssignments] = React.useState([]);
  const [assignmentDraft, setAssignmentDraft] = React.useState({
    familyId: "",
    centerId: "",
  });

  const [familyTags, setFamilyTags] = React.useState([]);
  const [tagDraft, setTagDraft] = React.useState({
    familyId: "",
    tagType: "Together",
  });
  const [capacitySaving, setCapacitySaving] = React.useState({});
  const [capacitySaveStatus, setCapacitySaveStatus] = React.useState({});
  const [capacityLoadError, setCapacityLoadError] = React.useState("");
  const [centerRosterEntries, setCenterRosterEntries] = React.useState([]);
  const [selectedRosterCenterId, setSelectedRosterCenterId] =
    React.useState("");
  const [rosterLoading, setRosterLoading] = React.useState(true);
  const [rosterError, setRosterError] = React.useState("");

  React.useEffect(() => {
    const normalizedCenters = evacuationCenters.map((center) => ({
      id: center.id,
      name: center.name,
      address: center.location || "",
      capacity: Number(center.capacity) || 0,
      headcount: Number(center.current) || 0,
    }));
    setCenters(normalizedCenters);
  }, [evacuationCenters]);

  React.useEffect(() => {
    if (selectedRosterCenterId) {
      return;
    }
    const firstCenter = centers[0];
    if (firstCenter) {
      setSelectedRosterCenterId(String(firstCenter.id));
    }
  }, [centers, selectedRosterCenterId]);

  React.useEffect(() => {
    const capacityRef = collection(db, "evacuationCenterCapacity");

    const unsubscribe = onSnapshot(
      capacityRef,
      (snapshot) => {
        setCapacityLoadError("");
        const updatesByCenterId = new Map();

        snapshot.forEach((centerDoc) => {
          const data = centerDoc.data() || {};
          const rawCenterId = data.centerId ?? centerDoc.id;
          const numericCenterId = Number(rawCenterId);
          const centerId = Number.isFinite(numericCenterId)
            ? numericCenterId
            : String(rawCenterId);

          const capacity = Number(data.capacity);
          const headcount = Number(data.headcount);

          updatesByCenterId.set(String(centerId), {
            id: centerId,
            name: data.centerName || "Evacuation Center",
            address: data.address || "",
            capacity:
              Number.isFinite(capacity) && capacity > 0
                ? Math.floor(capacity)
                : 0,
            headcount:
              Number.isFinite(headcount) && headcount >= 0
                ? Math.floor(headcount)
                : 0,
          });
        });

        setCenters((prev) => {
          const merged = prev.map((center) => {
            const update = updatesByCenterId.get(String(center.id));
            if (!update) return center;

            const boundedHeadcount = Math.max(
              0,
              Math.min(update.headcount, update.capacity),
            );

            return {
              ...center,
              name: update.name || center.name,
              address: update.address || center.address,
              capacity: update.capacity || center.capacity,
              headcount: boundedHeadcount,
            };
          });

          const mergedIds = new Set(merged.map((center) => String(center.id)));
          const appended = [];

          updatesByCenterId.forEach((update) => {
            if (!mergedIds.has(String(update.id))) {
              appended.push(update);
            }
          });

          return [...merged, ...appended];
        });
      },
      (error) => {
        console.error("Failed to auto-load center capacity:", error);
        setCapacityLoadError(
          "Auto-load blocked by Firestore rules. Check evacuationCenterCapacity permissions.",
        );
      },
    );

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const residentsRef = collection(db, "users");
    const residentsQuery = query(residentsRef, where("role", "==", "resident"));

    const unsubscribe = onSnapshot(
      residentsQuery,
      (snapshot) => {
        setRosterLoading(false);
        setRosterError("");

        const entries = [];
        const centerById = new Map(
          centers.map((center) => [String(center.id), center]),
        );
        const centerByName = new Map(
          centers.map((center) => [normalizeCenterKey(center.name), center]),
        );

        snapshot.forEach((userDoc) => {
          const userData = userDoc.data() || {};
          const arrival = userData?.evacuationArrival || null;
          if (!arrival?.arrived) {
            return;
          }

          const accountType = String(
            userData?.accountType || userData?.userType || "",
          ).toLowerCase();
          const isFamily =
            accountType.includes("family") || Boolean(userData?.familyProfile);

          const arrivalCenterIdRaw = arrival.centerId;
          const arrivalCenterName = String(arrival.centerName || "").trim();
          const resolvedCenter =
            centerById.get(String(arrivalCenterIdRaw)) ||
            centerByName.get(normalizeCenterKey(arrivalCenterName));

          const familyMemberRows = isFamily
            ? getFamilyMemberRows(userData)
            : [];
          const totalMembersRaw = Number(
            userData?.familyProfile?.totalMembers ?? arrival.memberCount,
          );
          const totalMembers = isFamily
            ? Number.isFinite(totalMembersRaw) && totalMembersRaw > 0
              ? Math.floor(totalMembersRaw)
              : Math.max(1, familyMemberRows.length)
            : 1;

          entries.push({
            id: userDoc.id,
            userName:
              String(userData?.fullName || "Resident").trim() || "Resident",
            accountType: isFamily ? "Family" : "Individual",
            centerId:
              resolvedCenter?.id ??
              (arrivalCenterIdRaw !== undefined && arrivalCenterIdRaw !== null
                ? arrivalCenterIdRaw
                : ""),
            centerName:
              resolvedCenter?.name || arrivalCenterName || "Evacuation Center",
            memberCount: totalMembers,
            familyMembers: familyMemberRows,
            confirmedAt: arrival.confirmedAt || null,
          });
        });

        setCenterRosterEntries(entries);
      },
      (error) => {
        console.error("Failed to load center roster users:", error);
        setRosterLoading(false);
        setRosterError(
          "Unable to load center occupants. Check Firestore read rules for users.",
        );
      },
    );

    return () => unsubscribe();
  }, [centers]);

  const filteredRosterEntries = React.useMemo(() => {
    if (!selectedRosterCenterId) {
      return centerRosterEntries;
    }

    return centerRosterEntries.filter((entry) => {
      const entryCenterId = String(entry.centerId || "");
      return entryCenterId === String(selectedRosterCenterId);
    });
  }, [centerRosterEntries, selectedRosterCenterId]);

  const handlePlanUpload = () => {
    if (!planFile) return;

    setUploadedPlans((prev) => [
      {
        id: `plan-${Date.now()}`,
        fileName: planFile.name,
        fileType: planFile.type,
        uploadDate: new Date().toISOString().slice(0, 10),
        fileUrl: URL.createObjectURL(planFile),
      },
      ...prev,
    ]);

    setPlanFile(null);
    if (planFileInputRef.current) planFileInputRef.current.value = "";
  };

  const handleCenterSave = () => {
    if (
      !centerDraft.name.trim() ||
      !centerDraft.address.trim() ||
      !centerDraft.capacity
    ) {
      return;
    }

    const parsedCapacity = Number(centerDraft.capacity);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      return;
    }

    if (centerDraft.id) {
      setCenters((prev) =>
        prev.map((center) =>
          center.id === centerDraft.id
            ? {
                ...center,
                name: centerDraft.name.trim(),
                address: centerDraft.address.trim(),
                capacity: parsedCapacity,
                headcount: Math.min(center.headcount, parsedCapacity),
              }
            : center,
        ),
      );
    } else {
      setCenters((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: centerDraft.name.trim(),
          address: centerDraft.address.trim(),
          capacity: parsedCapacity,
          headcount: 0,
        },
      ]);
    }

    setCenterDraft({
      id: null,
      name: "",
      address: "",
      capacity: "",
    });
  };

  const startCenterEdit = (center) => {
    setCenterDraft({
      id: center.id,
      name: center.name,
      address: center.address,
      capacity: String(center.capacity),
    });
  };

  const updateHeadcount = (centerId, value) => {
    const parsedValue = Number(value);

    setCenters((prev) =>
      prev.map((center) => {
        if (center.id !== centerId) return center;
        const bounded = Number.isFinite(parsedValue)
          ? Math.max(0, Math.min(parsedValue, center.capacity))
          : 0;
        return { ...center, headcount: bounded };
      }),
    );
  };

  const updateAvailableSlots = (centerId, value) => {
    const parsedValue = Number(value);

    setCenters((prev) =>
      prev.map((center) => {
        if (center.id !== centerId) return center;
        const boundedSlots = Number.isFinite(parsedValue)
          ? Math.max(0, Math.min(parsedValue, center.capacity))
          : 0;
        return { ...center, headcount: center.capacity - boundedSlots };
      }),
    );
  };

  const handleSaveCapacityUpdate = async (center) => {
    if (!center) return;

    const availableSlots = Math.max(0, center.capacity - center.headcount);
    const centerDocId = String(center.id);

    setCapacitySaving((prev) => ({ ...prev, [centerDocId]: true }));
    setCapacitySaveStatus((prev) => ({ ...prev, [centerDocId]: "" }));

    try {
      await setDoc(
        doc(db, "evacuationCenterCapacity", centerDocId),
        {
          centerId: center.id,
          centerName: center.name,
          address: center.address,
          capacity: center.capacity,
          headcount: center.headcount,
          availableSlots,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setCapacitySaveStatus((prev) => ({
        ...prev,
        [centerDocId]: "",
      }));
    } catch (error) {
      console.error("Failed to save capacity update:", error);
      setCapacitySaveStatus((prev) => ({
        ...prev,
        [centerDocId]: "Save failed",
      }));
    } finally {
      setCapacitySaving((prev) => ({ ...prev, [centerDocId]: false }));
    }
  };

  const handleAssignmentSave = () => {
    if (!assignmentDraft.familyId.trim() || !assignmentDraft.centerId) {
      return;
    }

    setFamilyAssignments((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.familyId === assignmentDraft.familyId.trim(),
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          centerId: Number(assignmentDraft.centerId),
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `assign-${Date.now()}`,
          familyId: assignmentDraft.familyId.trim(),
          centerId: Number(assignmentDraft.centerId),
        },
      ];
    });

    setAssignmentDraft({ familyId: "", centerId: "" });
  };

  const handleTagSave = () => {
    if (!tagDraft.familyId.trim()) {
      return;
    }

    setFamilyTags((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.familyId === tagDraft.familyId.trim(),
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          tagType: tagDraft.tagType,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `tag-${Date.now()}`,
          familyId: tagDraft.familyId.trim(),
          tagType: tagDraft.tagType,
        },
      ];
    });

    setTagDraft({ familyId: "", tagType: "Together" });
  };

  const getCenterName = (centerId) => {
    const center = centers.find((item) => item.id === Number(centerId));
    return center?.name || "Unknown Center";
  };

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <h3 className='text-xl font-black text-[#3a4a5b]'>Evacuation Plans</h3>
        <p className='text-sm text-gray-500 mt-1'>
          Upload plans, manage centers, update capacity, and track family
          assignments.
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Upload Plans
          </h4>
          <p className='text-xs text-gray-500 mb-4'>
            Upload official evacuation maps
          </p>

          <input
            ref={planFileInputRef}
            type='file'
            accept='.pdf,.png,.jpg,.jpeg,.doc,.docx'
            onChange={(event) => {
              const file = event.target.files[0];
              if (!file) return;
              setPlanFile(file);
            }}
            className='hidden'
          />

          <div
            onClick={() => planFileInputRef.current?.click()}
            className='cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors bg-gray-50 hover:bg-blue-50 mb-3'
          >
            <svg xmlns='http://www.w3.org/2000/svg' className='w-8 h-8 text-gray-400' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5' />
            </svg>
            <p className='text-sm font-semibold text-gray-600'>Click to select a file</p>
            <p className='text-xs text-gray-400'>PDF, PNG, JPG, DOC, DOCX</p>
          </div>

          {planFile && (
            <div className='flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-3'>
              <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 text-blue-500 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13' />
              </svg>
              <span className='text-xs text-blue-700 font-medium truncate flex-1'>{planFile.name}</span>
              <button
                type='button'
                onClick={() => { setPlanFile(null); if (planFileInputRef.current) planFileInputRef.current.value = ''; }}
                className='text-gray-400 hover:text-red-500 text-base leading-none font-bold flex-shrink-0'
              >
                ×
              </button>
            </div>
          )}

          <button
            type='button'
            onClick={handlePlanUpload}
            disabled={!planFile}
            className='w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed mb-4'
          >
            Upload Plan
          </button>

          <div className='space-y-2'>
            {uploadedPlans.length === 0 ? (
              <p className='text-xs text-gray-500'>No uploaded plans yet.</p>
            ) : (
              uploadedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className='flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5'
                >
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-semibold text-[#3a4a5b] truncate'>{plan.fileName}</p>
                    <p className='text-xs text-gray-500 mt-0.5'>{plan.uploadDate}</p>
                  </div>
                  {plan.fileUrl && (
                    <a
                      href={plan.fileUrl}
                      download={plan.fileName}
                      target='_blank'
                      rel='noreferrer'
                      className='flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap'
                    >
                      Download
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Manage Centers
          </h4>
          <p className='text-xs text-gray-500 mb-3'>
            Add/edit evacuation centers
          </p>

          <div className='grid grid-cols-1 md:grid-cols-12 gap-2 mb-4'>
            <input
              type='text'
              value={centerDraft.name}
              onChange={(event) =>
                setCenterDraft((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder='Center Name'
              className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <input
              type='text'
              value={centerDraft.address}
              onChange={(event) =>
                setCenterDraft((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              placeholder='Address'
              className='md:col-span-5 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <input
              type='number'
              min='1'
              value={centerDraft.capacity}
              onChange={(event) =>
                setCenterDraft((prev) => ({
                  ...prev,
                  capacity: event.target.value,
                }))
              }
              placeholder='Capacity'
              className='md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <button
              type='button'
              onClick={handleCenterSave}
              className='md:col-span-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
            >
              {centerDraft.id ? "Save" : "Add"}
            </button>
          </div>

          <div className='space-y-2'>
            {centers.map((center) => (
              <div
                key={center.id}
                className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2'
              >
                <div>
                  <p className='font-bold text-[#3a4a5b]'>{center.name}</p>
                  <p className='text-xs text-gray-500'>{center.address}</p>
                  <p className='text-xs text-gray-600'>
                    Capacity: {center.capacity}
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => startCenterEdit(center)}
                  className='px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200'
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Capacity Updates
          </h4>
          <p className='text-xs text-gray-500 mb-3'>Real-time adjustments</p>
          {capacityLoadError && (
            <p className='text-xs text-red-600 mb-3'>{capacityLoadError}</p>
          )}

          <div className='space-y-2'>
            {centers.map((center) => {
              const centerDocId = String(center.id);
              const isSaving = Boolean(capacitySaving[centerDocId]);
              const saveStatus = capacitySaveStatus[centerDocId] || "";
              const availableSlots = Math.max(
                0,
                center.capacity - center.headcount,
              );
              return (
                <div
                  key={`cap-${center.id}`}
                  className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                >
                  <div className='flex items-center justify-between gap-3'>
                    <p className='font-bold text-sm text-[#3a4a5b]'>
                      {center.name}
                    </p>
                    <div className='flex items-center gap-2'>
                      <label className='text-xs text-gray-500'>Headcount</label>
                      <input
                        type='number'
                        min='0'
                        max={center.capacity}
                        value={center.headcount}
                        onChange={(event) =>
                          updateHeadcount(center.id, event.target.value)
                        }
                        className='w-20 px-2 py-1 border border-gray-300 rounded text-xs bg-white text-slate-900'
                      />
                      <label className='text-xs text-gray-500'>Capacity</label>
                      <input
                        type='number'
                        min='0'
                        max={center.capacity}
                        value={availableSlots}
                        onChange={(event) =>
                          updateAvailableSlots(center.id, event.target.value)
                        }
                        className='w-20 px-2 py-1 border border-gray-300 rounded text-xs bg-white text-slate-900'
                      />
                      <button
                        type='button'
                        onClick={() => handleSaveCapacityUpdate(center)}
                        disabled={isSaving}
                        className='px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed'
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                  <p className='text-xs text-gray-400 mt-1'>
                    Capacity:{" "}
                    <span className='font-semibold'>{center.capacity}</span>
                  </p>
                  {saveStatus && (
                    <p
                      className={`text-[11px] mt-1 font-semibold ${
                        saveStatus.includes("failed")
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {saveStatus}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Assign Families
          </h4>
          <p className='text-xs text-gray-500 mb-3'>Assign evac center</p>

          <div className='grid grid-cols-1 md:grid-cols-12 gap-2 mb-4'>
            <input
              type='text'
              value={assignmentDraft.familyId}
              onChange={(event) =>
                setAssignmentDraft((prev) => ({
                  ...prev,
                  familyId: event.target.value,
                }))
              }
              placeholder='Family ID'
              className='md:col-span-5 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <select
              value={assignmentDraft.centerId}
              onChange={(event) =>
                setAssignmentDraft((prev) => ({
                  ...prev,
                  centerId: event.target.value,
                }))
              }
              className='md:col-span-5 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
            >
              <option value=''>Center ID</option>
              {centers.map((center) => (
                <option key={`center-opt-${center.id}`} value={center.id}>
                  {center.id} - {center.name}
                </option>
              ))}
            </select>
            <button
              type='button'
              onClick={handleAssignmentSave}
              className='md:col-span-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
            >
              Assign
            </button>
          </div>

          <div className='space-y-2'>
            {familyAssignments.length === 0 ? (
              <p className='text-xs text-gray-500'>
                No family assignments yet.
              </p>
            ) : (
              familyAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm'
                >
                  <p className='font-semibold text-[#3a4a5b]'>
                    Family ID: {assignment.familyId}
                  </p>
                  <p className='text-xs text-gray-600'>
                    Center ID: {assignment.centerId} (
                    {getCenterName(assignment.centerId)})
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
          Family Tags
        </h4>
        <p className='text-xs text-gray-500 mb-3'>Together / Separated</p>

        <div className='grid grid-cols-1 md:grid-cols-12 gap-2 mb-4'>
          <input
            type='text'
            value={tagDraft.familyId}
            onChange={(event) =>
              setTagDraft((prev) => ({ ...prev, familyId: event.target.value }))
            }
            placeholder='Family ID'
            className='md:col-span-6 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
          />
          <select
            value={tagDraft.tagType}
            onChange={(event) =>
              setTagDraft((prev) => ({ ...prev, tagType: event.target.value }))
            }
            className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
          >
            <option value='Together'>Together</option>
            <option value='Separated'>Separated</option>
          </select>
          <button
            type='button'
            onClick={handleTagSave}
            className='md:col-span-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
          >
            Save Tag
          </button>
        </div>

        <div className='space-y-2'>
          {familyTags.length === 0 ? (
            <p className='text-xs text-gray-500'>No family tags yet.</p>
          ) : (
            familyTags.map((tag) => (
              <div
                key={tag.id}
                className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between text-sm'
              >
                <span className='font-semibold text-[#3a4a5b]'>
                  Family ID: {tag.familyId}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    tag.tagType === "Together"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  Tag Type: {tag.tagType}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4'>
          <div>
            <h4 className='text-sm font-black text-[#3a4a5b] uppercase'>
              Evacuation Center Occupants
            </h4>
            <p className='text-xs text-gray-500 mt-1'>
              Residents currently marked as arrived in the selected center.
            </p>
          </div>
          <select
            value={selectedRosterCenterId}
            onChange={(event) => setSelectedRosterCenterId(event.target.value)}
            className='w-full md:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
          >
            {centers.length === 0 ? (
              <option value=''>No centers available</option>
            ) : (
              centers.map((center) => (
                <option key={`roster-center-${center.id}`} value={center.id}>
                  {center.name}
                </option>
              ))
            )}
          </select>
        </div>

        {rosterError ? (
          <p className='text-sm text-red-600'>{rosterError}</p>
        ) : rosterLoading ? (
          <p className='text-sm text-gray-500'>Loading occupants...</p>
        ) : filteredRosterEntries.length === 0 ? (
          <p className='text-sm text-gray-500'>
            No users currently marked as arrived in this center.
          </p>
        ) : (
          <div className='space-y-3'>
            {filteredRosterEntries.map((entry) => (
              <div
                key={`occupant-${entry.id}`}
                className='rounded-lg border border-gray-200 bg-gray-50 p-3'
              >
                <div className='flex flex-wrap items-center gap-2 justify-between'>
                  <div>
                    <p className='text-sm font-bold text-[#3a4a5b]'>
                      {entry.userName}
                    </p>
                    <p className='text-xs text-gray-500'>
                      {entry.accountType} Account • {entry.centerName}
                    </p>
                  </div>
                  <div className='text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full'>
                    Counted: {entry.memberCount}
                  </div>
                </div>

                {entry.accountType === "Family" ? (
                  <div className='mt-3 border-t border-gray-200 pt-2'>
                    <p className='text-[11px] font-black text-slate-600 uppercase mb-2'>
                      Family Members
                    </p>
                    <div className='space-y-1'>
                      {entry.familyMembers.length === 0 ? (
                        <p className='text-xs text-gray-500'>
                          No members listed.
                        </p>
                      ) : (
                        entry.familyMembers.map((member) => (
                          <p
                            key={`${entry.id}-${member.id}`}
                            className='text-xs text-gray-700'
                          >
                            <span className='font-semibold'>{member.name}</span>{" "}
                            <span className='text-gray-500'>
                              ({member.relationship})
                            </span>
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GovEvacuationPlansPage;
