import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faUsers,
  faCheckCircle,
  faCircle,
  faTriangleExclamation,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

class ResidentEvacPlan extends React.Component {
  static DISASTER_TYPES = [
    { key: "fire", label: "Fire", category: "Urban Fire" },
    { key: "typhoon", label: "Typhoon", category: "Weather" },
    { key: "earthquake", label: "Earthquake", category: "Seismic" },
    { key: "flood", label: "Flood", category: "Hydrological" },
  ];

  static GUIDE_STEPS = {
    fire: {
      before: [
        "Store emergency contacts in your phone and post a printed copy at home.",
        "Prepare a go-bag with IDs, medicines, assistive devices, and water.",
        "Check all exits and identify a smoke-free route for each room.",
      ],
      during: [
        "Stay low, cover nose and mouth with cloth, and move to the nearest safe exit.",
        "Use stairs only and avoid returning to rooms for belongings.",
        "Notify responders if family members need mobility or medical assistance.",
      ],
      after: [
        "Proceed only to authorized re-entry areas after clearance.",
        "Check each family member for injuries and report urgent needs.",
        "Document damage and update LGU or barangay responders.",
      ],
    },
    typhoon: {
      before: [
        "Charge phones, power banks, and backup lights early.",
        "Secure important documents in waterproof pouches.",
        "Review evacuation timing and nearest center before heavy winds start.",
      ],
      during: [
        "Keep away from windows and stay in the safest interior room.",
        "Move early if floodwater rises or local officials issue evacuation notice.",
        "Use text updates to coordinate with family and emergency contacts.",
      ],
      after: [
        "Avoid downed power lines and flooded roads.",
        "Use boiled or safe water only until supply is confirmed clean.",
        "Check center notices for relief schedules and return advisories.",
      ],
    },
    earthquake: {
      before: [
        "Anchor heavy furniture and identify safe spots per room.",
        "Prepare grab-and-go medicine and mobility support items.",
        "Practice household drills and meeting point instructions.",
      ],
      during: [
        "Drop, cover, and hold until shaking stops.",
        "Stay away from glass, cabinets, and unsecured appliances.",
        "Evacuate calmly after shaking and anticipate aftershocks.",
      ],
      after: [
        "Check injuries and provide first aid as needed.",
        "Turn off gas/electricity if damage is suspected.",
        "Follow LGU updates for safe routes and shelter assignment.",
      ],
    },
    flood: {
      before: [
        "Move valuables and medicines to higher shelves.",
        "Pack waterproof clothing and emergency food supplies.",
        "Plan transport for children, seniors, and PWD members early.",
      ],
      during: [
        "Do not walk or drive through moving floodwaters.",
        "Disconnect electrical sources if safe to do so.",
        "Proceed to your assigned center as soon as advised.",
      ],
      after: [
        "Return only after official clearance.",
        "Disinfect affected items and watch for water-borne illness symptoms.",
        "Update family status and submit assistance requests.",
      ],
    },
  };

  static EVAC_CENTERS = [
    {
      id: "center-1",
      name: "Sta. Maria Covered Court",
      distanceKm: 1.4,
      capacityStatus: "Available (41 slots)",
      supports: ["typhoon", "flood", "fire"],
    },
    {
      id: "center-2",
      name: "Cabayao Elementary School",
      distanceKm: 2.1,
      capacityStatus: "Near Capacity (3 slots)",
      supports: ["earthquake", "fire", "typhoon"],
    },
    {
      id: "center-3",
      name: "San Isidro Multi-Purpose Hall",
      distanceKm: 2.8,
      capacityStatus: "Available (19 slots)",
      supports: ["flood", "typhoon", "earthquake"],
    },
  ];

  constructor(props) {
    super(props);

    this.state = {
      userName: "Resident",
      accountType: "individual",
      hasAccessibilityNeeds: false,
      loadingPlan: true,
      isSavingPlan: false,
      lastSavedAt: null,
      disasterType: "typhoon",
      guidePhase: "before",
      meetingPoint: "",
      familyMembers: [{ id: Date.now(), name: "", assignedCenter: "" }],
      checklistInput: "",
      checklistItems: [
        { id: 1, label: "Bring IDs and emergency documents", done: false },
        { id: 2, label: "Prepare medicine and assistive devices", done: false },
        { id: 3, label: "Charge phone and power bank", done: false },
      ],
    };

    this.fetchResidentMeta = this.fetchResidentMeta.bind(this);
    this.handleDisasterTypeChange = this.handleDisasterTypeChange.bind(this);
    this.handleGuidePhaseChange = this.handleGuidePhaseChange.bind(this);
    this.getCurrentDisasterCategory =
      this.getCurrentDisasterCategory.bind(this);
    this.getCurrentGuideSteps = this.getCurrentGuideSteps.bind(this);
    this.getAssignedCenters = this.getAssignedCenters.bind(this);
    this.handleMeetingPointChange = this.handleMeetingPointChange.bind(this);
    this.handleFamilyMemberChange = this.handleFamilyMemberChange.bind(this);
    this.handleAddFamilyMember = this.handleAddFamilyMember.bind(this);
    this.handleRemoveFamilyMember = this.handleRemoveFamilyMember.bind(this);
    this.handleChecklistInputChange =
      this.handleChecklistInputChange.bind(this);
    this.handleAddChecklistItem = this.handleAddChecklistItem.bind(this);
    this.handleToggleChecklistItem = this.handleToggleChecklistItem.bind(this);
    this.scheduleSaveEvacPlan = this.scheduleSaveEvacPlan.bind(this);
    this.saveEvacPlan = this.saveEvacPlan.bind(this);
    this.buildEvacPlanPayload = this.buildEvacPlanPayload.bind(this);
    this.formatSavedTime = this.formatSavedTime.bind(this);
  }

  componentDidMount() {
    this.fetchResidentMeta();
  }

  componentDidUpdate(_prevProps, prevState) {
    const { currentUserId } = this.state;
    if (!currentUserId) return;

    const previousPayload = JSON.stringify(
      this.buildEvacPlanPayload(prevState),
    );
    const currentPayload = JSON.stringify(
      this.buildEvacPlanPayload(this.state),
    );

    if (previousPayload !== currentPayload) {
      this.scheduleSaveEvacPlan();
    }
  }

  componentWillUnmount() {
    if (this.savePlanTimer) {
      clearTimeout(this.savePlanTimer);
    }
  }

  async fetchResidentMeta() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      if (!snapshot.exists()) return;

      const profile = snapshot.data();
      const savedEvacPlan = profile.evacPlan || {};
      const selectedDisabilities =
        profile?.selectedDisabilities ||
        Object.keys(profile?.disabilities || {}).filter(
          (key) => profile.disabilities[key],
        );

      const savedFamilyMembers =
        Array.isArray(savedEvacPlan.familyMembers) &&
        savedEvacPlan.familyMembers.length > 0
          ? savedEvacPlan.familyMembers
          : [{ id: Date.now(), name: "", assignedCenter: "" }];

      const savedChecklistItems =
        Array.isArray(savedEvacPlan.checklistItems) &&
        savedEvacPlan.checklistItems.length > 0
          ? savedEvacPlan.checklistItems
          : [
              {
                id: 1,
                label: "Bring IDs and emergency documents",
                done: false,
              },
              {
                id: 2,
                label: "Prepare medicine and assistive devices",
                done: false,
              },
              { id: 3, label: "Charge phone and power bank", done: false },
            ];

      this.setState({
        loadingPlan: false,
        userName:
          profile.fullName || profile.personalInfo?.fullName || "Resident",
        accountType: profile.accountType || "individual",
        hasAccessibilityNeeds:
          Boolean(profile.hasDisability) || selectedDisabilities.length > 0,
        disasterType: savedEvacPlan.disasterType || "typhoon",
        guidePhase: savedEvacPlan.guidePhase || "before",
        meetingPoint: savedEvacPlan.meetingPoint || "",
        familyMembers: savedFamilyMembers,
        checklistItems: savedChecklistItems,
      });
    } catch (error) {
      console.error("Failed to load resident evacuation profile:", error);
      this.setState({ loadingPlan: false });
    }
  }

  buildEvacPlanPayload(sourceState = this.state) {
    return {
      disasterType: sourceState.disasterType,
      guidePhase: sourceState.guidePhase,
      meetingPoint: sourceState.meetingPoint,
      familyMembers: sourceState.familyMembers,
      checklistItems: sourceState.checklistItems,
    };
  }

  scheduleSaveEvacPlan() {
    if (this.savePlanTimer) {
      clearTimeout(this.savePlanTimer);
    }

    this.savePlanTimer = setTimeout(() => {
      this.saveEvacPlan();
    }, 700);
  }

  async saveEvacPlan() {
    const { currentUserId } = this.state;
    const user = auth.currentUser;
    const uid = currentUserId || user?.uid;

    if (!uid) return;

    this.setState({ isSavingPlan: true });

    try {
      await setDoc(
        doc(db, "users", uid),
        {
          evacPlan: this.buildEvacPlanPayload(),
          evacPlanUpdatedAt: new Date(),
        },
        { merge: true },
      );

      this.setState({
        isSavingPlan: false,
        lastSavedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to save evacuation plan:", error);
      this.setState({ isSavingPlan: false });
    }
  }

  formatSavedTime(value) {
    if (!(value instanceof Date)) {
      return "Not saved yet";
    }

    return value.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  handleDisasterTypeChange(event) {
    this.setState({ disasterType: event.target.value });
  }

  handleGuidePhaseChange(phase) {
    this.setState({ guidePhase: phase });
  }

  getCurrentDisasterCategory() {
    const { disasterType } = this.state;
    const selected = ResidentEvacPlan.DISASTER_TYPES.find(
      (item) => item.key === disasterType,
    );
    return selected?.category || "General";
  }

  getCurrentGuideSteps() {
    const { disasterType, guidePhase } = this.state;
    return ResidentEvacPlan.GUIDE_STEPS[disasterType]?.[guidePhase] || [];
  }

  getAssignedCenters() {
    const { disasterType, hasAccessibilityNeeds } = this.state;

    const byDisaster = ResidentEvacPlan.EVAC_CENTERS.filter((center) =>
      center.supports.includes(disasterType),
    ).sort((a, b) => a.distanceKm - b.distanceKm);

    if (!hasAccessibilityNeeds) {
      return byDisaster;
    }

    return [...byDisaster].sort((a, b) => {
      const aIsAvailable = a.capacityStatus.toLowerCase().includes("available");
      const bIsAvailable = b.capacityStatus.toLowerCase().includes("available");
      if (aIsAvailable === bIsAvailable) return a.distanceKm - b.distanceKm;
      return aIsAvailable ? -1 : 1;
    });
  }

  handleMeetingPointChange(event) {
    this.setState({ meetingPoint: event.target.value });
  }

  handleFamilyMemberChange(memberId, field, value) {
    this.setState((prevState) => ({
      familyMembers: prevState.familyMembers.map((member) =>
        member.id === memberId ? { ...member, [field]: value } : member,
      ),
    }));
  }

  handleAddFamilyMember() {
    this.setState((prevState) => ({
      familyMembers: [
        ...prevState.familyMembers,
        { id: Date.now() + Math.random(), name: "", assignedCenter: "" },
      ],
    }));
  }

  handleRemoveFamilyMember(memberId) {
    this.setState((prevState) => {
      const nextMembers = prevState.familyMembers.filter(
        (member) => member.id !== memberId,
      );
      return {
        familyMembers:
          nextMembers.length > 0
            ? nextMembers
            : [{ id: Date.now(), name: "", assignedCenter: "" }],
      };
    });
  }

  handleChecklistInputChange(event) {
    this.setState({ checklistInput: event.target.value });
  }

  handleAddChecklistItem() {
    const { checklistInput } = this.state;
    const trimmed = checklistInput.trim();
    if (!trimmed) return;

    this.setState((prevState) => ({
      checklistInput: "",
      checklistItems: [
        ...prevState.checklistItems,
        {
          id: Date.now() + Math.random(),
          label: trimmed,
          done: false,
        },
      ],
    }));
  }

  handleToggleChecklistItem(itemId) {
    this.setState((prevState) => ({
      checklistItems: prevState.checklistItems.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item,
      ),
    }));
  }

  render() {
    const {
      userName,
      accountType,
      loadingPlan,
      isSavingPlan,
      lastSavedAt,
      disasterType,
      guidePhase,
      meetingPoint,
      familyMembers,
      checklistInput,
      checklistItems,
      hasAccessibilityNeeds,
    } = this.state;

    const disasterCategory = this.getCurrentDisasterCategory();
    const guideSteps = this.getCurrentGuideSteps();
    const assignedCenters = this.getAssignedCenters();
    const completedCount = checklistItems.filter((item) => item.done).length;

    return (
      <section className='space-y-4'>
        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <div className='mb-3 text-xs font-black uppercase tracking-wide text-slate-500 flex items-center justify-between'>
            <span>Plan Sync</span>
            <span className='flex items-center gap-2'>
              {loadingPlan ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Loading...
                </>
              ) : isSavingPlan ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Saving...
                </>
              ) : (
                <>Saved at {this.formatSavedTime(lastSavedAt)}</>
              )}
            </span>
          </div>

          <h2 className='text-xl font-black text-slate-800 uppercase tracking-tight'>
            Disaster Type Selection
          </h2>
          <p className='text-sm text-slate-600 mt-1'>
            Choose disaster type and review disaster category guidance.
          </p>

          <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
            <div>
              <label
                htmlFor='evac-disaster-type'
                className='text-xs font-black text-slate-500 uppercase tracking-wide'
              >
                Disaster Type
              </label>
              <select
                id='evac-disaster-type'
                value={disasterType}
                onChange={this.handleDisasterTypeChange}
                className='mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700'
              >
                {ResidentEvacPlan.DISASTER_TYPES.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className='border border-blue-200 bg-blue-50 rounded-xl px-4 py-3'>
              <p className='text-xs font-black text-blue-700 uppercase'>
                Disaster Category
              </p>
              <p className='text-sm font-semibold text-slate-700 mt-1'>
                {disasterCategory}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Before / During / After Guides
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Step-by-step text guide in accessibility-friendly format.
          </p>

          <div className='mt-4 flex flex-wrap gap-2'>
            {[
              { key: "before", label: "Before" },
              { key: "during", label: "During" },
              { key: "after", label: "After" },
            ].map((phase) => (
              <button
                key={phase.key}
                onClick={() => this.handleGuidePhaseChange(phase.key)}
                aria-pressed={guidePhase === phase.key}
                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase transition-colors ${
                  guidePhase === phase.key
                    ? "bg-blue-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {phase.label}
              </button>
            ))}
          </div>

          <ol className='mt-4 space-y-2'>
            {guideSteps.map((step, index) => (
              <li
                key={`${guidePhase}-${index}`}
                className='border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 leading-relaxed'
              >
                <span className='text-blue-700 font-black mr-2'>
                  {index + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Assigned Evacuation Centers
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Personalized recommendations for {userName}.
          </p>

          {hasAccessibilityNeeds && (
            <p className='mt-3 text-xs font-black text-amber-700 uppercase flex items-center gap-2'>
              <FontAwesomeIcon icon={faTriangleExclamation} /> Prioritized by
              accessibility and available capacity
            </p>
          )}

          <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
            {assignedCenters.map((center) => (
              <div
                key={center.id}
                className='border border-slate-200 rounded-xl p-4 bg-slate-50'
              >
                <p className='text-xs font-black text-slate-700 uppercase flex items-center gap-2'>
                  <FontAwesomeIcon icon={faHouse} className='text-blue-700' />
                  {center.name}
                </p>
                <p className='text-sm font-semibold text-slate-700 mt-2'>
                  Distance: {center.distanceKm.toFixed(1)} km
                </p>
                <p className='text-sm font-semibold text-slate-700'>
                  Capacity status: {center.capacityStatus}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Family Evacuation Plan
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Custom plan per{" "}
            {accountType === "residential-family" ? "family" : "household"}.
          </p>

          <div className='mt-4'>
            <label
              htmlFor='evac-meeting-point'
              className='text-xs font-black text-slate-500 uppercase tracking-wide'
            >
              Assigned Meeting Point
            </label>
            <input
              id='evac-meeting-point'
              type='text'
              value={meetingPoint}
              onChange={this.handleMeetingPointChange}
              placeholder='Enter meeting point (e.g., Barangay Hall Gate)'
              className='mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700'
            />
          </div>

          <div className='mt-4 space-y-3'>
            {familyMembers.map((member, index) => (
              <div
                key={member.id}
                className='border border-slate-200 rounded-xl p-4 bg-slate-50'
              >
                <p className='text-xs font-black text-slate-500 uppercase mb-2 flex items-center gap-2'>
                  <FontAwesomeIcon icon={faUsers} className='text-blue-700' />
                  Member {index + 1}
                </p>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                  <input
                    type='text'
                    value={member.name}
                    onChange={(event) =>
                      this.handleFamilyMemberChange(
                        member.id,
                        "name",
                        event.target.value,
                      )
                    }
                    placeholder='Member name'
                    aria-label='Family member name'
                    className='px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700'
                  />
                  <select
                    value={member.assignedCenter}
                    onChange={(event) =>
                      this.handleFamilyMemberChange(
                        member.id,
                        "assignedCenter",
                        event.target.value,
                      )
                    }
                    aria-label='Assign evacuation center for this member'
                    className='px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700'
                  >
                    <option value=''>Assign center per member</option>
                    {assignedCenters.map((center) => (
                      <option key={center.id} value={center.name}>
                        {center.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='mt-2'>
                  <button
                    onClick={() => this.handleRemoveFamilyMember(member.id)}
                    className='text-xs font-black uppercase text-red-600 hover:text-red-700'
                  >
                    Remove member
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={this.handleAddFamilyMember}
              className='text-xs font-black uppercase bg-blue-700 text-white px-3 py-2 rounded-lg hover:bg-blue-800'
            >
              Add family member
            </button>
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Checklist
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Custom emergency checklist with completion status.
          </p>

          <div className='mt-4 flex gap-2'>
            <input
              type='text'
              value={checklistInput}
              onChange={this.handleChecklistInputChange}
              placeholder='Add checklist item...'
              className='flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700'
            />
            <button
              onClick={this.handleAddChecklistItem}
              className='bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-800'
            >
              Add Item
            </button>
          </div>

          <p className='mt-3 text-xs font-black text-slate-500 uppercase'>
            Completion status: {completedCount}/{checklistItems.length}
          </p>

          <div className='mt-3 space-y-2'>
            {checklistItems.map((item) => (
              <button
                key={item.id}
                onClick={() => this.handleToggleChecklistItem(item.id)}
                className='w-full text-left border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 flex items-center justify-between gap-2 hover:border-blue-200'
              >
                <span
                  className={`text-sm font-semibold ${
                    item.done ? "text-slate-400 line-through" : "text-slate-700"
                  }`}
                >
                  <FontAwesomeIcon
                    icon={item.done ? faCheckCircle : faCircle}
                    className={`mr-2 ${item.done ? "text-green-600" : "text-slate-400"}`}
                  />
                  {item.label}
                </span>
                <span className='text-xs font-black uppercase text-slate-500'>
                  {item.done ? "Completed" : "Pending"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }
}

export default ResidentEvacPlan;
