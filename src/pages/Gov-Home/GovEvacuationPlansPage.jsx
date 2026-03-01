import React from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

function GovEvacuationPlansPage({ evacuationCenters = [] }) {
  const [uploadedPlans, setUploadedPlans] = React.useState([
    {
      id: "plan-1",
      fileName: "Sta-Maria-Evacuation-Zones.pdf",
      version: "v1.2",
      uploadDate: "2026-03-01",
    },
  ]);
  const [planDraft, setPlanDraft] = React.useState({
    fileName: "",
    version: "",
    uploadDate: new Date().toISOString().slice(0, 10),
  });

  const [centers, setCenters] = React.useState([]);
  const [centerDraft, setCenterDraft] = React.useState({
    id: null,
    name: "",
    address: "",
    capacity: "",
  });

  const [familyAssignments, setFamilyAssignments] = React.useState([
    {
      id: "assign-1",
      familyId: "FAM-1001",
      centerId: 1,
    },
  ]);
  const [assignmentDraft, setAssignmentDraft] = React.useState({
    familyId: "",
    centerId: "",
  });

  const [familyTags, setFamilyTags] = React.useState([
    {
      id: "tag-1",
      familyId: "FAM-1001",
      tagType: "Together",
    },
  ]);
  const [tagDraft, setTagDraft] = React.useState({
    familyId: "",
    tagType: "Together",
  });
  const [capacitySaving, setCapacitySaving] = React.useState({});
  const [capacitySaveStatus, setCapacitySaveStatus] = React.useState({});
  const [capacityLoadError, setCapacityLoadError] = React.useState("");

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

  const handlePlanUpload = () => {
    if (
      !planDraft.fileName.trim() ||
      !planDraft.version.trim() ||
      !planDraft.uploadDate
    ) {
      return;
    }

    setUploadedPlans((prev) => [
      {
        id: `plan-${Date.now()}`,
        fileName: planDraft.fileName.trim(),
        version: planDraft.version.trim(),
        uploadDate: planDraft.uploadDate,
      },
      ...prev,
    ]);

    setPlanDraft((prev) => ({
      ...prev,
      fileName: "",
      version: "",
      uploadDate: new Date().toISOString().slice(0, 10),
    }));
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
          <p className='text-xs text-gray-500 mb-3'>
            Upload official evacuation maps
          </p>

          <div className='grid grid-cols-1 md:grid-cols-12 gap-2 mb-4'>
            <input
              type='text'
              value={planDraft.fileName}
              onChange={(event) =>
                setPlanDraft((prev) => ({
                  ...prev,
                  fileName: event.target.value,
                }))
              }
              placeholder='File Name'
              className='md:col-span-5 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <input
              type='text'
              value={planDraft.version}
              onChange={(event) =>
                setPlanDraft((prev) => ({
                  ...prev,
                  version: event.target.value,
                }))
              }
              placeholder='Version'
              className='md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <input
              type='date'
              value={planDraft.uploadDate}
              onChange={(event) =>
                setPlanDraft((prev) => ({
                  ...prev,
                  uploadDate: event.target.value,
                }))
              }
              className='md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
            />
            <button
              type='button'
              onClick={handlePlanUpload}
              className='md:col-span-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
            >
              Add
            </button>
          </div>

          <div className='space-y-2'>
            {uploadedPlans.map((plan) => (
              <div
                key={plan.id}
                className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm'
              >
                <p className='font-bold text-[#3a4a5b]'>{plan.fileName}</p>
                <p className='text-xs text-gray-600'>Version: {plan.version}</p>
                <p className='text-xs text-gray-500'>
                  Upload Date: {plan.uploadDate}
                </p>
              </div>
            ))}
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
                  <p className='text-xs text-gray-600 mt-1'>
                    Available Slots:{" "}
                    <span className='font-bold'>{availableSlots}</span>
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
            {familyAssignments.map((assignment) => (
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
            ))}
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
          {familyTags.map((tag) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}

export default GovEvacuationPlansPage;
