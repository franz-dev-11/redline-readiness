import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faHouseFloodWater,
  faShieldHeart,
  faBullhorn,
  faClockRotateLeft,
  faSpinner,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import EmergencyEventService from "../../services/EmergencyEventService";

class ResidentAlerts extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      sendingSos: false,
      resolvingAlertId: null,
      currentUserId: null,
      userName: "Resident",
      locationLabel: "Location unavailable",
      disabilityType: "Not specified",
      medicalNeeds: "Not specified",
      sosTriggeredAt: null,
      emergencyEvents: [],
    };

    this.fetchResidentProfile = this.fetchResidentProfile.bind(this);
    this.startEmergencyFeedListener =
      this.startEmergencyFeedListener.bind(this);
    this.handleTriggerSOS = this.handleTriggerSOS.bind(this);
    this.resolveCurrentLocation = this.resolveCurrentLocation.bind(this);
    this.formatDateTime = this.formatDateTime.bind(this);
    this.getAnnouncements = this.getAnnouncements.bind(this);
    this.getEvacuationUpdates = this.getEvacuationUpdates.bind(this);
    this.getAlertHistory = this.getAlertHistory.bind(this);
    this.getTypeLabel = this.getTypeLabel.bind(this);
    this.handleResolveAlert = this.handleResolveAlert.bind(this);
    this.getResolvedSourceIds = this.getResolvedSourceIds.bind(this);
  }

  componentDidMount() {
    this.fetchResidentProfile();
    this.startEmergencyFeedListener();
  }

  componentWillUnmount() {
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }
  }

  async fetchResidentProfile() {
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

      const profile = snapshot.data();
      const selectedDisabilities =
        profile?.selectedDisabilities ||
        Object.keys(profile?.disabilities || {}).filter(
          (key) => profile.disabilities[key],
        );

      this.setState({
        loading: false,
        currentUserId: user.uid,
        userName:
          profile.fullName || profile.personalInfo?.fullName || "Resident",
        disabilityType:
          selectedDisabilities.length > 0
            ? selectedDisabilities.join(", ")
            : profile.hasDisability
              ? "Disability declared"
              : "Not specified",
        medicalNeeds:
          profile.medicalNeeds || profile.disabilityNotes || "None noted",
      });
    } catch (error) {
      console.error("Failed to load resident profile for alerts:", error);
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
      }, 24);
  }

  resolveCurrentLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({
          locationLabel: "Geolocation not supported",
          coordinates: null,
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = Number(position.coords.latitude.toFixed(6));
          const longitude = Number(position.coords.longitude.toFixed(6));
          resolve({
            locationLabel: `Lat ${latitude}, Lng ${longitude}`,
            coordinates: { lat: latitude, lng: longitude },
          });
        },
        () => {
          resolve({
            locationLabel: "Location permission denied",
            coordinates: null,
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }

  async handleTriggerSOS() {
    const { sendingSos, userName, disabilityType, medicalNeeds } = this.state;
    const currentUser = auth.currentUser;

    if (sendingSos || !currentUser) return;

    const confirmed = window.confirm(
      "Trigger SOS now? This will notify responders and share your emergency details.",
    );
    if (!confirmed) return;

    this.setState({ sendingSos: true });

    try {
      const { locationLabel, coordinates } =
        await this.resolveCurrentLocation();
      const now = new Date();

      await EmergencyEventService.createSosEvent({
        userId: currentUser.uid,
        userName,
        locationLabel,
        disabilityType,
        medicalNeeds,
        coordinates,
        alertTitle: "Resident SOS Alert",
        description: `${userName} needs immediate assistance.`,
        triggeredAt: now,
      });

      this.setState({
        sendingSos: false,
        sosTriggeredAt: now,
        locationLabel,
      });
    } catch (error) {
      console.error("Failed to trigger SOS:", error);
      this.setState({ sendingSos: false });
      alert("Failed to trigger SOS. Please try again.");
    }
  }

  formatDateTime(value) {
    const dateValue = value?.toDate ? value.toDate() : value;

    if (!(dateValue instanceof Date)) {
      return "just now";
    }

    return dateValue.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  getAnnouncements() {
    const { emergencyEvents } = this.state;
    return emergencyEvents.filter((event) => event.type === "announcement");
  }

  getEvacuationUpdates() {
    const { emergencyEvents } = this.state;

    return emergencyEvents.filter(
      (event) =>
        event.type === "evacuation-update" ||
        (event.type === "announcement" &&
          (event.category === "evacuation" ||
            event.centerName ||
            event.updatedSlots)),
    );
  }

  getTypeLabel(type) {
    if (type === "sos") return "SOS";
    if (type === "announcement") return "LGU Announcement";
    if (type === "evacuation-update") return "Evacuation Update";
    if (type === "location-share") return "Location Share";
    return "Alert";
  }

  getResolvedSourceIds() {
    const { emergencyEvents } = this.state;
    const resolvedSet = new Set();

    emergencyEvents.forEach((event) => {
      if (
        event.type === "resolution" &&
        event.sourceEventId &&
        (event.status === "resolved" || event.status === "stopped")
      ) {
        resolvedSet.add(event.sourceEventId);
      }
    });

    return resolvedSet;
  }

  getAlertHistory() {
    const { emergencyEvents, currentUserId } = this.state;
    const resolvedSourceIds = this.getResolvedSourceIds();

    return emergencyEvents
      .filter((event) => event.type !== "resolution")
      .slice(0, 12)
      .map((event) => {
        const status =
          event.status === "stopped" ||
          event.status === "resolved" ||
          resolvedSourceIds.has(event.id)
            ? "Resolved"
            : "Active";

        return {
          id: event.id,
          type: event.type,
          typeLabel: this.getTypeLabel(event.type),
          dateTime: this.formatDateTime(event.createdAt),
          status,
          canResolve:
            status === "Active" &&
            event.userId === currentUserId &&
            (event.type === "sos" || event.type === "location-share"),
        };
      });
  }

  async handleResolveAlert(alertItem) {
    const { resolvingAlertId, userName, currentUserId } = this.state;

    if (!alertItem?.id || resolvingAlertId) return;

    const confirmed = window.confirm("Mark this alert as resolved?");
    if (!confirmed) return;

    this.setState({ resolvingAlertId: alertItem.id });

    try {
      await EmergencyEventService.createResolutionEvent({
        userId: currentUserId,
        userName,
        sourceEventId: alertItem.id,
        sourceType: alertItem.type,
        resolutionNote: "Resolved by resident",
      });
      this.setState({ resolvingAlertId: null });
    } catch (error) {
      console.error("Failed to resolve alert:", error);
      this.setState({ resolvingAlertId: null });
      alert("Failed to resolve alert. Please try again.");
    }
  }

  render() {
    const {
      loading,
      sendingSos,
      resolvingAlertId,
      userName,
      locationLabel,
      disabilityType,
      medicalNeeds,
      sosTriggeredAt,
    } = this.state;

    const announcements = this.getAnnouncements();
    const evacuationUpdates = this.getEvacuationUpdates();
    const alertHistory = this.getAlertHistory();
    const activeAlertHistory = alertHistory.filter(
      (item) => item.status === "Active",
    );
    const resolvedAlertHistory = alertHistory.filter(
      (item) => item.status === "Resolved",
    );

    const renderHistoryItem = (item) => (
      <div
        key={item.id}
        className='border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-2'
      >
        <p className='text-xs font-black text-slate-700 uppercase flex items-center gap-2'>
          <FontAwesomeIcon icon={faClockRotateLeft} /> Alert type:{" "}
          {item.typeLabel}
        </p>
        <p className='text-xs font-bold text-slate-500 uppercase'>
          Date/time: {item.dateTime}
        </p>
        <p
          className={`text-xs font-black uppercase flex items-center gap-1 ${
            item.status === "Resolved" ? "text-green-700" : "text-red-700"
          }`}
        >
          <FontAwesomeIcon
            icon={item.status === "Resolved" ? faCircleCheck : faShieldHeart}
          />
          Status: {item.status}
        </p>
        {item.canResolve && (
          <button
            onClick={() => this.handleResolveAlert(item)}
            disabled={resolvingAlertId === item.id}
            className='text-xs font-black uppercase bg-slate-700 text-white px-3 py-1 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {resolvingAlertId === item.id ? "Resolving..." : "Resolve"}
          </button>
        )}
      </div>
    );

    return (
      <section className='space-y-4'>
        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h2 className='text-xl font-black text-slate-800 uppercase tracking-tight'>
            SOS Alerts
          </h2>
          <p className='text-sm text-slate-600 mt-1'>
            Trigger SOS with confirmation and share your emergency profile.
          </p>

          <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
            <p className='text-sm font-semibold text-slate-700'>
              User name: <span className='text-slate-500'>{userName}</span>
            </p>
            <p className='text-sm font-semibold text-slate-700'>
              Location: <span className='text-slate-500'>{locationLabel}</span>
            </p>
            <p className='text-sm font-semibold text-slate-700'>
              Disability type:{" "}
              <span className='text-slate-500'>{disabilityType}</span>
            </p>
            <p className='text-sm font-semibold text-slate-700'>
              Medical needs:{" "}
              <span className='text-slate-500'>{medicalNeeds}</span>
            </p>
          </div>

          <div className='mt-4 flex items-center gap-3'>
            <button
              onClick={this.handleTriggerSOS}
              disabled={sendingSos || loading}
              className='bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-black uppercase hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {sendingSos ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className='mr-2' />
                  Sending SOS...
                </>
              ) : (
                <>
                  <FontAwesomeIcon
                    icon={faTriangleExclamation}
                    className='mr-2'
                  />
                  Trigger SOS
                </>
              )}
            </button>
            {sosTriggeredAt && (
              <p className='text-xs font-bold text-red-700 uppercase'>
                SOS sent: {this.formatDateTime(sosTriggeredAt)}
              </p>
            )}
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            LGU Announcements
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            View posted emergency alerts from LGU.
          </p>

          <div className='mt-4 space-y-3'>
            {announcements.length === 0 ? (
              <p className='text-sm text-slate-500'>
                No announcements posted yet.
              </p>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className='border border-blue-200 bg-blue-50 rounded-xl p-4'
                >
                  <p className='text-xs font-black text-blue-700 uppercase flex items-center gap-2'>
                    <FontAwesomeIcon icon={faBullhorn} />
                    {announcement.alertTitle || "Emergency Alert"}
                  </p>
                  <p className='text-sm font-semibold text-slate-700 mt-1'>
                    {announcement.message ||
                      announcement.description ||
                      "No description provided."}
                  </p>
                  <div className='mt-2 text-[11px] font-bold text-slate-500 uppercase flex items-center gap-3'>
                    <span>
                      Timestamp: {this.formatDateTime(announcement.createdAt)}
                    </span>
                    <span>LGU Source: {announcement.userName || "LGU"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Evacuation Updates
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Capacity changes by center.
          </p>

          <div className='mt-4 space-y-3'>
            {evacuationUpdates.length === 0 ? (
              <div className='border border-amber-200 bg-amber-50 rounded-xl p-4'>
                <p className='text-xs font-black text-amber-700 uppercase flex items-center gap-2'>
                  <FontAwesomeIcon icon={faHouseFloodWater} /> No capacity
                  changes yet
                </p>
              </div>
            ) : (
              evacuationUpdates.map((update) => (
                <div
                  key={update.id}
                  className='border border-amber-200 bg-amber-50 rounded-xl p-4'
                >
                  <p className='text-xs font-black text-amber-700 uppercase flex items-center gap-2'>
                    <FontAwesomeIcon icon={faHouseFloodWater} /> Capacity Update
                  </p>
                  <p className='text-sm font-semibold text-slate-700 mt-1'>
                    Center name: {update.centerName || "Unspecified Center"}
                  </p>
                  <p className='text-sm font-semibold text-slate-700'>
                    Updated slots: {update.updatedSlots || "Not provided"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Alert History
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Past alerts with status.
          </p>

          <div className='mt-4 space-y-2'>
            {alertHistory.length === 0 ? (
              <p className='text-sm text-slate-500'>No alert history yet.</p>
            ) : (
              <>
                {activeAlertHistory.length > 0 && (
                  <details
                    className='border border-slate-200 rounded-lg bg-slate-50/50'
                    open={activeAlertHistory.length <= 4}
                  >
                    <summary className='px-3 py-2 text-[10px] font-black text-red-600 uppercase tracking-wide cursor-pointer'>
                      Active ({activeAlertHistory.length})
                    </summary>
                    <div className='p-3 pt-0 space-y-2'>
                      {activeAlertHistory.map((item) =>
                        renderHistoryItem(item),
                      )}
                    </div>
                  </details>
                )}

                {resolvedAlertHistory.length > 0 && (
                  <details className='border border-slate-200 rounded-lg bg-slate-50/50'>
                    <summary className='px-3 py-2 text-[10px] font-black text-green-700 uppercase tracking-wide cursor-pointer'>
                      Resolved ({resolvedAlertHistory.length})
                    </summary>
                    <div className='p-3 pt-0 space-y-2'>
                      {resolvedAlertHistory.map((item) =>
                        renderHistoryItem(item),
                      )}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    );
  }
}

export default ResidentAlerts;
