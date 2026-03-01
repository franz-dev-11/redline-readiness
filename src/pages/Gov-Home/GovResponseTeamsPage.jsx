import React from "react";

const RESPONSE_TEAMS = [
  {
    id: "team-alpha",
    name: "Team Alpha",
  },
  {
    id: "team-bravo",
    name: "Team Bravo",
  },
  {
    id: "team-charlie",
    name: "Team Charlie",
  },
];

const STATUS_OPTIONS = ["Dispatched", "En Route", "Resolved"];

function GovResponseTeamsPage() {
  const [responders, setResponders] = React.useState([
    {
      id: "resp-1",
      name: "Aimee Santos",
      role: "Medic",
      contactInfo: "0917-200-3344",
    },
    {
      id: "resp-2",
      name: "Victor Ramos",
      role: "Rescue Lead",
      contactInfo: "0917-455-8123",
    },
  ]);
  const [responderDraft, setResponderDraft] = React.useState({
    name: "",
    role: "",
    contactInfo: "",
  });

  const [deployments, setDeployments] = React.useState([
    {
      id: "dep-1",
      sosId: "SOS-2401",
      assignedTeamId: "team-bravo",
      status: "En Route",
      incidentType: "Medical Assistance",
      createdAt: "2026-02-28T08:25:00.000Z",
      resolvedAt: null,
    },
    {
      id: "dep-2",
      sosId: "SOS-2397",
      assignedTeamId: "team-alpha",
      status: "Resolved",
      incidentType: "Flood Evacuation",
      createdAt: "2026-02-27T17:10:00.000Z",
      resolvedAt: "2026-02-27T18:02:00.000Z",
    },
  ]);
  const [deploymentDraft, setDeploymentDraft] = React.useState({
    sosId: "",
    assignedTeamId: RESPONSE_TEAMS[0].id,
    incidentType: "SOS Alert",
  });

  const [teamNotes, setTeamNotes] = React.useState([
    {
      id: "note-1",
      deploymentId: "dep-1",
      note: "Ambulance ETA 6 minutes.",
      timestamp: "2026-03-01T02:48:00.000Z",
    },
  ]);
  const [noteDraft, setNoteDraft] = React.useState({
    deploymentId: "",
    note: "",
  });

  const getTeamName = React.useCallback((teamId) => {
    return (
      RESPONSE_TEAMS.find((team) => team.id === teamId)?.name || "Unknown Team"
    );
  }, []);

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

  const handleAddResponder = () => {
    if (
      !responderDraft.name.trim() ||
      !responderDraft.role.trim() ||
      !responderDraft.contactInfo.trim()
    ) {
      return;
    }

    setResponders((prev) => [
      {
        id: `resp-${Date.now()}`,
        name: responderDraft.name.trim(),
        role: responderDraft.role.trim(),
        contactInfo: responderDraft.contactInfo.trim(),
      },
      ...prev,
    ]);

    setResponderDraft({ name: "", role: "", contactInfo: "" });
  };

  const handleDeployToSos = () => {
    if (!deploymentDraft.sosId.trim() || !deploymentDraft.assignedTeamId) {
      return;
    }

    setDeployments((prev) => [
      {
        id: `dep-${Date.now()}`,
        sosId: deploymentDraft.sosId.trim().toUpperCase(),
        assignedTeamId: deploymentDraft.assignedTeamId,
        status: "Dispatched",
        incidentType: deploymentDraft.incidentType.trim() || "SOS Alert",
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      },
      ...prev,
    ]);

    setDeploymentDraft((prev) => ({
      ...prev,
      sosId: "",
      incidentType: "SOS Alert",
    }));
  };

  const handleStatusUpdate = (deploymentId, nextStatus) => {
    setDeployments((prev) =>
      prev.map((deployment) => {
        if (deployment.id !== deploymentId) {
          return deployment;
        }

        if (nextStatus === "Resolved") {
          return {
            ...deployment,
            status: nextStatus,
            resolvedAt: new Date().toISOString(),
          };
        }

        return {
          ...deployment,
          status: nextStatus,
          resolvedAt: null,
        };
      }),
    );
  };

  const handleAddTeamNote = () => {
    if (!noteDraft.deploymentId || !noteDraft.note.trim()) {
      return;
    }

    setTeamNotes((prev) => [
      {
        id: `note-${Date.now()}`,
        deploymentId: noteDraft.deploymentId,
        note: noteDraft.note.trim(),
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);

    setNoteDraft({ deploymentId: "", note: "" });
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
            {responders.map((responder) => (
              <div
                key={responder.id}
                className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
              >
                <p className='text-sm font-bold text-[#3a4a5b]'>
                  {responder.name}
                </p>
                <p className='text-xs text-gray-600'>{responder.role}</p>
                <p className='text-xs text-gray-500'>{responder.contactInfo}</p>
              </div>
            ))}
          </div>
        </div>

        <div className='xl:col-span-6 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <h4 className='text-sm font-black text-[#3a4a5b] uppercase mb-4'>
            Assign to SOS
          </h4>

          <div className='grid grid-cols-1 md:grid-cols-12 gap-2 mb-4'>
            <input
              type='text'
              value={deploymentDraft.sosId}
              onChange={(event) =>
                setDeploymentDraft((prev) => ({
                  ...prev,
                  sosId: event.target.value,
                }))
              }
              placeholder='SOS ID'
              className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500'
            />
            <select
              value={deploymentDraft.assignedTeamId}
              onChange={(event) =>
                setDeploymentDraft((prev) => ({
                  ...prev,
                  assignedTeamId: event.target.value,
                }))
              }
              className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-900'
            >
              {RESPONSE_TEAMS.map((team) => (
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
              className='md:col-span-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
            >
              Deploy
            </button>
          </div>

          <div className='space-y-2 max-h-60 overflow-y-auto pr-1'>
            {deployments.slice(0, 6).map((deployment) => (
              <div
                key={deployment.id}
                className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
              >
                <p className='text-sm font-bold text-[#3a4a5b]'>
                  {deployment.sosId} • {getTeamName(deployment.assignedTeamId)}
                </p>
                <p className='text-xs text-gray-500'>
                  {deployment.incidentType} •{" "}
                  {formatDateTime(deployment.createdAt)}
                </p>
              </div>
            ))}
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
