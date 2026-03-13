import React from "react";
import EmergencyEventService from "../../services/EmergencyEventService";
import GovResponseTeamsService from "../../services/GovResponseTeamsService";

const STATUS_OPTIONS = ["Dispatched", "En Route", "Resolved"];

function getFirestoreActionErrorMessage(error, entityLabel) {
  const code = String(error?.code || "").toLowerCase();

  if (code.includes("permission-denied")) {
    return `Failed to save ${entityLabel}. Firestore rules are blocking this action. Add rules for government response team collections, publish them in Firebase Console, then try again.`;
  }

  return `Failed to save ${entityLabel}. Please try again.`;
}

function GovResponseTeamsPage() {
  const [teams, setTeams] = React.useState([]);
  const [responders, setResponders] = React.useState([]);
  const [responderDraft, setResponderDraft] = React.useState({
    name: "",
    role: "",
    contactInfo: "",
  });
  const [teamDraft, setTeamDraft] = React.useState({
    name: "",
    memberIds: [],
  });
  const [editingTeamId, setEditingTeamId] = React.useState("");
  const [editTeamDraft, setEditTeamDraft] = React.useState({
    name: "",
    memberIds: [],
  });
  const [savingTeamId, setSavingTeamId] = React.useState("");

  const [deployments, setDeployments] = React.useState([]);
  const [deploymentDraft, setDeploymentDraft] = React.useState({
    sosId: "",
    assignedTeamId: "",
    incidentType: "SOS Alert",
  });
  const [activeSosEvents, setActiveSosEvents] = React.useState([]);

  const [teamNotes, setTeamNotes] = React.useState([]);
  const [noteDraft, setNoteDraft] = React.useState({
    deploymentId: "",
    note: "",
  });

  React.useEffect(() => {
    const unsubscribeResponders =
      GovResponseTeamsService.subscribeToResponders(setResponders);
    const unsubscribeTeams = GovResponseTeamsService.subscribeToTeams(setTeams);
    const unsubscribeDeployments =
      GovResponseTeamsService.subscribeToDeployments(setDeployments);
    const unsubscribeNotes =
      GovResponseTeamsService.subscribeToTeamNotes(setTeamNotes);

    return () => {
      unsubscribeResponders();
      unsubscribeTeams();
      unsubscribeDeployments();
      unsubscribeNotes();
    };
  }, []);

  React.useEffect(() => {
    const unsubscribeEmergencyEvents =
      EmergencyEventService.subscribeToRecentEvents((events) => {
        const resolvedSourceEventIds = new Set(
          events
            .filter(
              (event) => event.type === "resolution" && event.sourceEventId,
            )
            .map((event) => event.sourceEventId),
        );

        const activeSos = events.filter(
          (event) =>
            event.type === "sos" &&
            event.status !== "resolved" &&
            !resolvedSourceEventIds.has(event.id),
        );

        const dedupedActiveSos = [];
        const seenIncidentKeys = new Set();

        activeSos.forEach((event) => {
          const incidentKey = String(
            event.userId || event.userName || event.id,
          );
          if (seenIncidentKeys.has(incidentKey)) {
            return;
          }

          seenIncidentKeys.add(incidentKey);
          dedupedActiveSos.push(event);
        });

        setActiveSosEvents(dedupedActiveSos);
      }, 100);

    return () => {
      unsubscribeEmergencyEvents();
    };
  }, []);

  React.useEffect(() => {
    if (teams.length === 0) {
      setDeploymentDraft((prev) => ({
        ...prev,
        assignedTeamId: "",
      }));
      return;
    }

    setDeploymentDraft((prev) => {
      if (prev.assignedTeamId) {
        return prev;
      }

      return {
        ...prev,
        assignedTeamId: teams[0].id,
      };
    });
  }, [teams]);

  React.useEffect(() => {
    if (activeSosEvents.length === 0) {
      setDeploymentDraft((prev) => ({
        ...prev,
        sosId: "",
      }));
      return;
    }

    setDeploymentDraft((prev) => {
      const stillExists = activeSosEvents.some(
        (event) => event.id === prev.sosId,
      );
      if (stillExists) {
        return prev;
      }

      return {
        ...prev,
        sosId: activeSosEvents[0].id,
      };
    });
  }, [activeSosEvents]);

  const getTeamName = React.useCallback(
    (teamId) => {
      return teams.find((team) => team.id === teamId)?.name || "Unknown Team";
    },
    [teams],
  );

  const getResponderName = React.useCallback(
    (responderId) => {
      return (
        responders.find((responder) => responder.id === responderId)?.name ||
        "Unknown responder"
      );
    },
    [responders],
  );

  const formatDateTime = React.useCallback((rawDate) => {
    if (!rawDate) return "—";
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return "—";

    return parsed.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const getActiveSosLabel = React.useCallback(
    (event) => {
      const disasterType = String(
        event?.disasterTypeLabel || event?.disasterType || "SOS Alert",
      ).trim();
      const userName = String(event?.userName || "Resident").trim();
      const createdAt = formatDateTime(event?.createdAt);

      return `${userName} • ${disasterType} • ${createdAt}`;
    },
    [formatDateTime],
  );

  const activeDeployments = deployments.filter(
    (deployment) => deployment.status !== "Resolved",
  );
  const deploymentHistory = deployments
    .filter((deployment) => deployment.status === "Resolved")
    .sort(
      (a, b) =>
        new Date(b.resolvedAt || b.createdAt).getTime() -
        new Date(a.resolvedAt || a.createdAt).getTime(),
    );

  const handleAddResponder = async () => {
    if (
      !responderDraft.name.trim() ||
      !responderDraft.role.trim() ||
      !responderDraft.contactInfo.trim()
    ) {
      return;
    }

    try {
      await GovResponseTeamsService.createResponder({
        name: responderDraft.name.trim(),
        role: responderDraft.role.trim(),
        contactInfo: responderDraft.contactInfo.trim(),
      });

      setResponderDraft({ name: "", role: "", contactInfo: "" });
    } catch (error) {
      console.error("Failed to save responder:", error);
      alert(getFirestoreActionErrorMessage(error, "responder"));
    }
  };

  const handleToggleTeamMember = (responderId) => {
    setTeamDraft((prev) => {
      const alreadyIncluded = prev.memberIds.includes(responderId);
      return {
        ...prev,
        memberIds: alreadyIncluded
          ? prev.memberIds.filter((id) => id !== responderId)
          : [...prev.memberIds, responderId],
      };
    });
  };

  const handleCreateTeam = async () => {
    if (!teamDraft.name.trim() || teamDraft.memberIds.length === 0) {
      return;
    }

    try {
      await GovResponseTeamsService.createTeam({
        name: teamDraft.name.trim(),
        memberIds: [...teamDraft.memberIds],
      });

      setTeamDraft({ name: "", memberIds: [] });
    } catch (error) {
      console.error("Failed to create team:", error);
      alert(getFirestoreActionErrorMessage(error, "team"));
    }
  };

  const handleStartEditTeam = (team) => {
    setEditingTeamId(team.id);
    setEditTeamDraft({
      name: String(team.name || ""),
      memberIds: Array.isArray(team.memberIds) ? [...team.memberIds] : [],
    });
  };

  const handleCancelEditTeam = () => {
    setEditingTeamId("");
    setEditTeamDraft({ name: "", memberIds: [] });
  };

  const handleToggleEditTeamMember = (responderId) => {
    setEditTeamDraft((prev) => {
      const alreadyIncluded = prev.memberIds.includes(responderId);
      return {
        ...prev,
        memberIds: alreadyIncluded
          ? prev.memberIds.filter((id) => id !== responderId)
          : [...prev.memberIds, responderId],
      };
    });
  };

  const handleSaveTeamChanges = async () => {
    if (!editingTeamId) return;

    if (!editTeamDraft.name.trim() || editTeamDraft.memberIds.length === 0) {
      return;
    }

    try {
      setSavingTeamId(editingTeamId);
      await GovResponseTeamsService.updateTeam(editingTeamId, {
        name: editTeamDraft.name.trim(),
        memberIds: [...editTeamDraft.memberIds],
      });
      handleCancelEditTeam();
    } catch (error) {
      console.error("Failed to update team:", error);
      alert(getFirestoreActionErrorMessage(error, "team"));
    } finally {
      setSavingTeamId("");
    }
  };

  const handleDeployToSos = async () => {
    if (!deploymentDraft.sosId.trim() || !deploymentDraft.assignedTeamId) {
      return;
    }

    try {
      await GovResponseTeamsService.createDeployment({
        sosId: deploymentDraft.sosId.trim().toUpperCase(),
        assignedTeamId: deploymentDraft.assignedTeamId,
        status: "Dispatched",
        incidentType: deploymentDraft.incidentType.trim() || "SOS Alert",
      });

      setDeploymentDraft((prev) => ({
        ...prev,
        sosId: "",
        incidentType: "SOS Alert",
      }));
    } catch (error) {
      console.error("Failed to create deployment:", error);
      alert(getFirestoreActionErrorMessage(error, "deployment"));
    }
  };

  const handleStatusUpdate = async (deploymentId, nextStatus) => {
    try {
      await GovResponseTeamsService.updateDeploymentStatus(
        deploymentId,
        nextStatus,
      );
    } catch (error) {
      console.error("Failed to update deployment status:", error);
      alert(getFirestoreActionErrorMessage(error, "deployment status"));
    }
  };

  const handleAddTeamNote = async () => {
    if (!noteDraft.deploymentId || !noteDraft.note.trim()) {
      return;
    }

    try {
      await GovResponseTeamsService.createTeamNote({
        deploymentId: noteDraft.deploymentId,
        note: noteDraft.note.trim(),
      });

      setNoteDraft({ deploymentId: "", note: "" });
    } catch (error) {
      console.error("Failed to save team note:", error);
      alert(getFirestoreActionErrorMessage(error, "team note"));
    }
  };

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <h3 className='text-xl font-black text-[#3a4a5b]'>Response Teams</h3>
        <p className='text-sm text-gray-500 mt-1'>
          Register responders, deploy teams, and monitor mission progress.
        </p>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
        <div className='xl:col-span-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Register Responders
          </h4>

          <div className='grid grid-cols-1 md:grid-cols-12 gap-2 mb-4'>
            <input
              type='text'
              value={responderDraft.name}
              onChange={(event) =>
                setResponderDraft((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder='Name'
              className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <input
              type='text'
              value={responderDraft.role}
              onChange={(event) =>
                setResponderDraft((prev) => ({
                  ...prev,
                  role: event.target.value,
                }))
              }
              placeholder='Role'
              className='md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <input
              type='text'
              value={responderDraft.contactInfo}
              onChange={(event) =>
                setResponderDraft((prev) => ({
                  ...prev,
                  contactInfo: event.target.value,
                }))
              }
              placeholder='Contact Info'
              className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <button
              type='button'
              onClick={handleAddResponder}
              className='md:col-span-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
            >
              Add
            </button>
          </div>

          <div className='space-y-2 max-h-60 overflow-y-auto pr-1'>
            {responders.length === 0 ? (
              <p className='text-sm text-gray-500'>
                No responders registered yet.
              </p>
            ) : (
              responders.map((responder) => (
                <div
                  key={responder.id}
                  className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                >
                  <p className='text-sm font-bold text-[#3a4a5b]'>
                    {responder.name}
                  </p>
                  <p className='text-xs text-gray-600'>{responder.role}</p>
                  <p className='text-xs text-gray-500'>
                    {responder.contactInfo}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='xl:col-span-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Create Teams
          </h4>

          <div className='space-y-3'>
            <input
              type='text'
              value={teamDraft.name}
              onChange={(event) =>
                setTeamDraft((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder='Team name'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />

            <div className='rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-48 overflow-y-auto'>
              {responders.length === 0 ? (
                <p className='text-sm text-gray-500'>
                  Register responders first before creating a team.
                </p>
              ) : (
                <div className='space-y-2'>
                  {responders.map((responder) => {
                    const isSelected = teamDraft.memberIds.includes(
                      responder.id,
                    );

                    return (
                      <label
                        key={responder.id}
                        className='flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-pointer'
                      >
                        <input
                          type='checkbox'
                          checked={isSelected}
                          onChange={() => handleToggleTeamMember(responder.id)}
                          className='peer sr-only'
                        />
                        <span className='mt-0.5 h-4 w-4 rounded border border-slate-300 bg-white flex items-center justify-center text-[10px] font-black text-transparent peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300'>
                          ✓
                        </span>
                        <span className='min-w-0'>
                          <span className='block text-sm font-bold text-[#3a4a5b]'>
                            {responder.name}
                          </span>
                          <span className='block text-xs text-gray-600'>
                            {responder.role} • {responder.contactInfo}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type='button'
              onClick={handleCreateTeam}
              disabled={responders.length === 0}
              className='w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Create Team
            </button>
          </div>

          <div className='mt-4 space-y-2 max-h-52 overflow-y-auto pr-1'>
            {teams.length === 0 ? (
              <p className='text-sm text-gray-500'>No teams created yet.</p>
            ) : (
              teams.map((team) => (
                <div
                  key={team.id}
                  className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                >
                  {editingTeamId === team.id ? (
                    <div className='space-y-2'>
                      <input
                        type='text'
                        value={editTeamDraft.name}
                        onChange={(event) =>
                          setEditTeamDraft((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        placeholder='Team name'
                        className='w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-slate-900'
                      />
                      <div className='rounded border border-gray-200 bg-white p-2 max-h-32 overflow-y-auto'>
                        {responders.length === 0 ? (
                          <p className='text-xs text-gray-500'>
                            No responders available.
                          </p>
                        ) : (
                          <div className='space-y-1'>
                            {responders.map((responder) => {
                              const isSelected =
                                editTeamDraft.memberIds.includes(responder.id);

                              return (
                                <label
                                  key={`${team.id}-${responder.id}`}
                                  className='flex items-center gap-2 text-xs text-slate-700'
                                >
                                  <input
                                    type='checkbox'
                                    checked={isSelected}
                                    onChange={() =>
                                      handleToggleEditTeamMember(responder.id)
                                    }
                                    className='peer sr-only'
                                  />
                                  <span className='h-4 w-4 rounded border border-slate-300 bg-white flex items-center justify-center text-[10px] font-black text-transparent peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300'>
                                    ✓
                                  </span>
                                  <span>
                                    {responder.name} • {responder.role}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className='flex gap-2'>
                        <button
                          type='button'
                          onClick={handleSaveTeamChanges}
                          disabled={savingTeamId === team.id}
                          className='px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {savingTeamId === team.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type='button'
                          onClick={handleCancelEditTeam}
                          disabled={savingTeamId === team.id}
                          className='px-3 py-1.5 rounded bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className='text-sm font-bold text-[#3a4a5b]'>
                        {team.name}
                      </p>
                      <p className='text-xs text-gray-500 mt-1'>
                        {team.memberIds.length} member
                        {team.memberIds.length === 1 ? "" : "s"}
                      </p>
                      <p className='text-xs text-gray-600 mt-1'>
                        {team.memberIds
                          .map((memberId) => getResponderName(memberId))
                          .join(", ")}
                      </p>
                      <div className='mt-2'>
                        <button
                          type='button'
                          onClick={() => handleStartEditTeam(team)}
                          className='px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:border-blue-200 hover:text-blue-700'
                        >
                          Edit Team
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
        <div className='xl:col-span-12 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Assign to SOS
          </h4>

          <div className='grid grid-cols-1 md:grid-cols-12 gap-2 mb-4'>
            <select
              value={deploymentDraft.sosId}
              onChange={(event) =>
                setDeploymentDraft((prev) => ({
                  ...prev,
                  sosId: event.target.value,
                }))
              }
              disabled={activeSosEvents.length === 0}
              className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
            >
              <option value=''>
                {activeSosEvents.length === 0
                  ? "No active SOS triggers"
                  : "Select active SOS"}
              </option>
              {activeSosEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {getActiveSosLabel(event)}
                </option>
              ))}
            </select>
            <select
              value={deploymentDraft.assignedTeamId}
              onChange={(event) =>
                setDeploymentDraft((prev) => ({
                  ...prev,
                  assignedTeamId: event.target.value,
                }))
              }
              disabled={teams.length === 0}
              className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
            >
              <option value=''>
                {teams.length === 0
                  ? "No teams available"
                  : "Select response team"}
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <input
              type='text'
              value={deploymentDraft.incidentType}
              onChange={(event) =>
                setDeploymentDraft((prev) => ({
                  ...prev,
                  incidentType: event.target.value,
                }))
              }
              placeholder='Incident Type'
              className='md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <button
              type='button'
              onClick={handleDeployToSos}
              disabled={teams.length === 0 || activeSosEvents.length === 0}
              className='md:col-span-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
            >
              Deploy
            </button>
          </div>

          <div className='space-y-2 max-h-60 overflow-y-auto pr-1'>
            {deployments.length === 0 ? (
              <p className='text-sm text-gray-500'>No team deployments yet.</p>
            ) : (
              deployments.slice(0, 6).map((deployment) => (
                <div
                  key={deployment.id}
                  className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                >
                  <p className='text-sm font-bold text-[#3a4a5b]'>
                    {deployment.sosId} •{" "}
                    {getTeamName(deployment.assignedTeamId)}
                  </p>
                  <p className='text-xs text-gray-500'>
                    {deployment.incidentType} •{" "}
                    {formatDateTime(deployment.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
        <div className='xl:col-span-7 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Status Tracking
          </h4>
          <p className='text-xs text-gray-500 mb-3'>
            Monitor response: Dispatched, En Route, Resolved
          </p>

          {deployments.length === 0 ? (
            <p className='text-sm text-gray-500'>No deployments yet.</p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-[11px] font-black uppercase text-gray-500 border-b border-gray-200'>
                    <th className='py-2 pr-2'>SOS ID</th>
                    <th className='py-2 pr-2'>Assigned Team</th>
                    <th className='py-2 pr-2'>Status</th>
                    <th className='py-2'>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((deployment) => (
                    <tr
                      key={`status-${deployment.id}`}
                      className='border-b border-gray-100'
                    >
                      <td className='py-2 pr-2 font-semibold text-[#3a4a5b]'>
                        {deployment.sosId}
                      </td>
                      <td className='py-2 pr-2 text-gray-700'>
                        {getTeamName(deployment.assignedTeamId)}
                      </td>
                      <td className='py-2 pr-2'>
                        <select
                          value={deployment.status}
                          onChange={(event) =>
                            handleStatusUpdate(
                              deployment.id,
                              event.target.value,
                            )
                          }
                          className='px-2 py-1 border border-gray-300 rounded text-xs bg-white text-slate-900'
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className='py-2 text-gray-600 text-xs'>
                        {formatDateTime(
                          deployment.resolvedAt || deployment.createdAt,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className='xl:col-span-5 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Team Notes
          </h4>
          <p className='text-xs text-gray-500 mb-3'>
            Internal communication with timestamp
          </p>

          <div className='space-y-2 mb-3'>
            <select
              value={noteDraft.deploymentId}
              onChange={(event) =>
                setNoteDraft((prev) => ({
                  ...prev,
                  deploymentId: event.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
            >
              <option value=''>Select SOS Mission</option>
              {activeDeployments.map((deployment) => (
                <option key={deployment.id} value={deployment.id}>
                  {deployment.sosId} • {getTeamName(deployment.assignedTeamId)}
                </option>
              ))}
            </select>
            <textarea
              value={noteDraft.note}
              onChange={(event) =>
                setNoteDraft((prev) => ({
                  ...prev,
                  note: event.target.value,
                }))
              }
              placeholder='Notes'
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500 resize-none'
            />
            <button
              type='button'
              onClick={handleAddTeamNote}
              className='w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
            >
              Add Note
            </button>
          </div>

          <div className='space-y-2 max-h-56 overflow-y-auto pr-1'>
            {teamNotes.length === 0 ? (
              <p className='text-sm text-gray-500'>No notes yet.</p>
            ) : (
              teamNotes.map((teamNote) => {
                const linkedDeployment = deployments.find(
                  (deployment) => deployment.id === teamNote.deploymentId,
                );
                return (
                  <div
                    key={teamNote.id}
                    className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                  >
                    <p className='text-xs font-bold text-[#3a4a5b]'>
                      {linkedDeployment?.sosId || "Mission"}
                    </p>
                    <p className='text-sm text-gray-700'>{teamNote.note}</p>
                    <p className='text-[11px] text-gray-500 mt-1'>
                      {formatDateTime(teamNote.timestamp)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
        <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
          Deployment History
        </h4>
        <p className='text-xs text-gray-500 mb-3'>
          View past missions (Date, Incident Type)
        </p>

        {deploymentHistory.length === 0 ? (
          <p className='text-sm text-gray-500'>No resolved missions yet.</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] font-black uppercase text-gray-500 border-b border-gray-200'>
                  <th className='py-2 pr-2'>Date</th>
                  <th className='py-2 pr-2'>Incident Type</th>
                  <th className='py-2 pr-2'>SOS ID</th>
                  <th className='py-2'>Assigned Team</th>
                </tr>
              </thead>
              <tbody>
                {deploymentHistory.map((deployment) => (
                  <tr
                    key={`history-${deployment.id}`}
                    className='border-b border-gray-100'
                  >
                    <td className='py-2 pr-2 text-gray-700'>
                      {formatDateTime(
                        deployment.resolvedAt || deployment.createdAt,
                      )}
                    </td>
                    <td className='py-2 pr-2 text-gray-700'>
                      {deployment.incidentType}
                    </td>
                    <td className='py-2 pr-2 font-semibold text-[#3a4a5b]'>
                      {deployment.sosId}
                    </td>
                    <td className='py-2 text-gray-700'>
                      {getTeamName(deployment.assignedTeamId)}
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

export default GovResponseTeamsPage;
