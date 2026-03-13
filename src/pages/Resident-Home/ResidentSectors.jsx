import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faUniversalAccess,
  faBullhorn,
  faHandsHelping,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import EmergencyEventService from "../../services/EmergencyEventService";

class ResidentSectors extends React.Component {
  static DISABILITY_FILTERS = [
    { key: "all", label: "All" },
    { key: "visual", label: "Visual" },
    { key: "hearing", label: "Hearing" },
    { key: "mobility", label: "Mobility" },
    { key: "cognitive", label: "Cognitive" },
    { key: "multiple", label: "Multiple" },
  ];

  static DISABILITY_ENTRIES = [
    { id: 1, category: "visual", title: "Visual Support Group" },
    { id: 2, category: "hearing", title: "Hearing Support Group" },
    { id: 3, category: "mobility", title: "Mobility Assistance Group" },
    { id: 4, category: "cognitive", title: "Cognitive Care Group" },
    { id: 5, category: "multiple", title: "Multiple Disability Group" },
  ];

  static SUPPORT_SERVICES = [
    {
      id: "svc-1",
      serviceType: "Assistive Device Loan",
      availabilityStatus: "Available",
    },
    {
      id: "svc-2",
      serviceType: "Transport Assistance",
      availabilityStatus: "Limited Slots",
    },
    {
      id: "svc-3",
      serviceType: "Home Visit Welfare Check",
      availabilityStatus: "Available",
    },
    {
      id: "svc-4",
      serviceType: "Medical Referral Support",
      availabilityStatus: "On Request",
    },
  ];

  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      savingNeeds: false,
      selectedDisabilityFilter: "all",
      userName: "Resident",
      accessibilityNeeds: {
        braille: false,
        vibrationAlerts: false,
        largeText: false,
      },
      emergencyEvents: [],
    };

    this.loadSectorData = this.loadSectorData.bind(this);
    this.startEmergencyFeedListener =
      this.startEmergencyFeedListener.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.handleToggleNeed = this.handleToggleNeed.bind(this);
    this.saveAccessibilityNeeds = this.saveAccessibilityNeeds.bind(this);
    this.getFilteredDisabilityEntries =
      this.getFilteredDisabilityEntries.bind(this);
    this.getSectorAnnouncements = this.getSectorAnnouncements.bind(this);
    this.getTargetLabel = this.getTargetLabel.bind(this);
    this.formatDateTime = this.formatDateTime.bind(this);
  }

  componentDidMount() {
    this.loadSectorData();
    this.startEmergencyFeedListener();
  }

  componentWillUnmount() {
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }
  }

  async loadSectorData() {
    const user = auth.currentUser;
    if (!user) {
      this.setState({ loading: false });
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      if (!snapshot.exists()) {
        this.setState({ loading: false });
        return;
      }

      const userData = snapshot.data();
      const needs = userData?.sectorNeeds || {};

      this.setState({
        loading: false,
        userName:
          userData.fullName || userData.personalInfo?.fullName || "Resident",
        accessibilityNeeds: {
          braille: Boolean(needs.braille),
          vibrationAlerts: Boolean(needs.vibrationAlerts),
          largeText: Boolean(needs.largeText),
        },
      });
    } catch (error) {
      console.error("Failed to load sectors data:", error);
      this.setState({ loading: false });
    }
  }

  startEmergencyFeedListener() {
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }

    this.emergencyFeedUnsubscribe =
      EmergencyEventService.subscribeToRecentEvents((events) => {
        this.setState({ emergencyEvents: events });
      }, 20);
  }

  handleFilterChange(filterKey) {
    this.setState({ selectedDisabilityFilter: filterKey });
  }

  async handleToggleNeed(key) {
    this.setState(
      (prevState) => ({
        accessibilityNeeds: {
          ...prevState.accessibilityNeeds,
          [key]: !prevState.accessibilityNeeds[key],
        },
      }),
      this.saveAccessibilityNeeds,
    );
  }

  async saveAccessibilityNeeds() {
    const user = auth.currentUser;
    if (!user) return;

    this.setState({ savingNeeds: true });

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          sectorNeeds: this.state.accessibilityNeeds,
          accessibilitySettings: {
            ...this.state.accessibilityNeeds,
            screenReader: this.state.accessibilityNeeds.vibrationAlerts,
            highContrast: this.state.accessibilityNeeds.braille,
          },
        },
        { merge: true },
      );
      this.setState({ savingNeeds: false });
    } catch (error) {
      console.error("Failed to save accessibility needs:", error);
      this.setState({ savingNeeds: false });
    }
  }

  getFilteredDisabilityEntries() {
    const { selectedDisabilityFilter } = this.state;

    if (selectedDisabilityFilter === "all") {
      return ResidentSectors.DISABILITY_ENTRIES;
    }

    return ResidentSectors.DISABILITY_ENTRIES.filter(
      (entry) => entry.category === selectedDisabilityFilter,
    );
  }

  getTargetLabel(group) {
    if (!group) return "General";
    return group
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  getSectorAnnouncements() {
    const { emergencyEvents, selectedDisabilityFilter } = this.state;

    const announcements = emergencyEvents.filter(
      (event) =>
        event.type === "announcement" &&
        (event.targetGroup || event.category === "sector"),
    );

    if (selectedDisabilityFilter === "all") {
      return announcements;
    }

    return announcements.filter(
      (event) => event.targetGroup === selectedDisabilityFilter,
    );
  }

  formatDateTime(value) {
    const dateValue = value?.toDate ? value.toDate() : value;

    if (!(dateValue instanceof Date)) {
      return "just now";
    }

    return dateValue.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  render() {
    const {
      loading,
      savingNeeds,
      selectedDisabilityFilter,
      userName,
      accessibilityNeeds,
    } = this.state;

    const filteredEntries = this.getFilteredDisabilityEntries();
    const sectorAnnouncements = this.getSectorAnnouncements();

    return (
      <section className='space-y-4'>
        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h2 className='text-xl font-black text-slate-800 uppercase tracking-tight'>
            Disability Category View
          </h2>
          <p className='text-sm text-slate-600 mt-1'>
            Filter by disability: Visual, Hearing, Mobility, Cognitive,
            Multiple.
          </p>

          <div className='mt-4 flex flex-wrap gap-2'>
            {ResidentSectors.DISABILITY_FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => this.handleFilterChange(filter.key)}
                aria-pressed={selectedDisabilityFilter === filter.key}
                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase ${
                  selectedDisabilityFilter === filter.key
                    ? "bg-blue-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className='border border-slate-200 rounded-xl p-4 bg-slate-50'
              >
                <p className='text-xs font-black text-slate-500 uppercase'>
                  Category
                </p>
                <p className='text-sm font-semibold text-slate-700 mt-1'>
                  {this.getTargetLabel(entry.category)}
                </p>
                <p className='text-sm font-black text-slate-800 mt-2 flex items-center gap-2'>
                  <FontAwesomeIcon icon={faUsers} className='text-blue-700' />
                  {entry.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Accessibility Needs
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            View/edit needs for {userName}: Braille, Vibration alerts, Large
            text.
          </p>

          {loading ? (
            <p className='mt-4 text-sm font-bold text-slate-500 flex items-center gap-2'>
              <FontAwesomeIcon icon={faSpinner} spin /> Loading accessibility
              needs...
            </p>
          ) : (
            <div className='mt-4 space-y-2'>
              {[
                { key: "braille", label: "Braille" },
                { key: "vibrationAlerts", label: "Vibration alerts" },
                { key: "largeText", label: "Large text" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => this.handleToggleNeed(item.key)}
                  aria-pressed={accessibilityNeeds[item.key]}
                  className='w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 flex items-center justify-between hover:border-blue-200'
                >
                  <span className='text-sm font-black text-slate-700 flex items-center gap-2'>
                    <FontAwesomeIcon
                      icon={faUniversalAccess}
                      className='text-blue-700'
                    />
                    {item.label}
                  </span>
                  <span
                    className={`text-xs font-black uppercase px-2 py-1 rounded-full ${
                      accessibilityNeeds[item.key]
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {accessibilityNeeds[item.key] ? "On" : "Off"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className='mt-3 text-xs font-black uppercase text-slate-500'>
            {savingNeeds ? (
              <span className='inline-flex items-center gap-2'>
                <FontAwesomeIcon icon={faSpinner} spin /> Saving changes...
              </span>
            ) : (
              "Needs synced to profile"
            )}
          </p>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            PWD Support Services
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            View LGU support services.
          </p>

          <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
            {ResidentSectors.SUPPORT_SERVICES.map((service) => (
              <div
                key={service.id}
                className='border border-slate-200 rounded-xl p-4 bg-slate-50'
              >
                <p className='text-sm font-black text-slate-800 flex items-center gap-2'>
                  <FontAwesomeIcon
                    icon={faHandsHelping}
                    className='text-blue-700'
                  />
                  {service.serviceType}
                </p>
                <p className='text-xs font-black text-slate-500 uppercase mt-2'>
                  Availability status: {service.availabilityStatus}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Sector-Based Announcements
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Targeted alerts by disability sector.
          </p>

          <div className='mt-4 space-y-3'>
            {sectorAnnouncements.length === 0 ? (
              <p className='text-sm text-slate-500'>
                No targeted announcements for this group yet.
              </p>
            ) : (
              sectorAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className='border border-blue-200 bg-blue-50 rounded-xl p-4'
                >
                  <p className='text-xs font-black text-blue-700 uppercase flex items-center gap-2'>
                    <FontAwesomeIcon icon={faBullhorn} />
                    {announcement.alertTitle || "Sector Alert"}
                  </p>
                  <p className='text-sm font-semibold text-slate-700 mt-1'>
                    {announcement.message ||
                      announcement.description ||
                      "No announcement details provided."}
                  </p>
                  <div className='mt-2 text-[11px] font-bold text-slate-500 uppercase flex items-center gap-3'>
                    <span>
                      Target group:{" "}
                      {this.getTargetLabel(announcement.targetGroup)}
                    </span>
                    <span>
                      Posted: {this.formatDateTime(announcement.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    );
  }
}

export default ResidentSectors;
