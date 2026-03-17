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
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import EmergencyEventService from "../../services/EmergencyEventService";

const LOW_ACCURACY_THRESHOLD_METERS = 100;

const SOS_DISASTER_TYPE_OPTIONS = [
  { value: "flood", label: "Flood" },
  { value: "earthquake", label: "Earthquake" },
  { value: "fire", label: "Fire" },
  { value: "landslide", label: "Landslide" },
  { value: "typhoon", label: "Typhoon" },
  { value: "medical", label: "Medical Emergency" },
  { value: "other", label: "Other" },
];

function getDisasterTypeLabel(disasterType) {
  const normalized = String(disasterType || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "General Emergency";
  }

  const knownType = SOS_DISASTER_TYPE_OPTIONS.find(
    (option) => option.value === normalized,
  );

  if (knownType) {
    return knownType.label;
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function isSecureGeolocationContext() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.isSecureContext) {
    return true;
  }

  const hostname = window.location?.hostname || "";
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

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
      selectedSosDisasterType: "",
      sosTriggeredAt: null,
      emergencyEvents: [],
      evacuationUpdates: [],
      evacuationUpdatesError: "",
    };

    this.fetchResidentProfile = this.fetchResidentProfile.bind(this);
    this.startEmergencyFeedListener =
      this.startEmergencyFeedListener.bind(this);
    this.startEvacuationUpdatesListener =
      this.startEvacuationUpdatesListener.bind(this);
    this.handleTriggerSOS = this.handleTriggerSOS.bind(this);
    this.confirmLowAccuracyProceed = this.confirmLowAccuracyProceed.bind(this);
    this.resolveCurrentLocation = this.resolveCurrentLocation.bind(this);
    this.resolveLocationLabelFromCoordinates =
      this.resolveLocationLabelFromCoordinates.bind(this);
    this.formatDateTime = this.formatDateTime.bind(this);
    this.getAnnouncements = this.getAnnouncements.bind(this);
    this.getEvacuationUpdates = this.getEvacuationUpdates.bind(this);
    this.getAlertHistory = this.getAlertHistory.bind(this);
    this.getTypeLabel = this.getTypeLabel.bind(this);
    this.handleResolveAlert = this.handleResolveAlert.bind(this);
    this.getResolvedSourceIds = this.getResolvedSourceIds.bind(this);
    this.getActiveSosForCurrentUser =
      this.getActiveSosForCurrentUser.bind(this);
    this.handleSosDisasterTypeChange =
      this.handleSosDisasterTypeChange.bind(this);
  }

  componentDidMount() {
    this.fetchResidentProfile();
    this.startEmergencyFeedListener();
    this.startEvacuationUpdatesListener();
  }

  componentWillUnmount() {
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }
    if (this.evacuationUpdatesUnsubscribe) {
      this.evacuationUpdatesUnsubscribe();
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

  startEvacuationUpdatesListener() {
    if (this.evacuationUpdatesUnsubscribe) {
      this.evacuationUpdatesUnsubscribe();
    }

    const capacityRef = collection(db, "evacuationCenterCapacity");

    this.evacuationUpdatesUnsubscribe = onSnapshot(
      capacityRef,
      (snapshot) => {
        const updates = snapshot.docs
          .map((snapshotDoc) => {
            const data = snapshotDoc.data() || {};
            const rawCapacity =
              data.capacity ?? data.maxCapacity ?? data.totalCapacity;
            const rawHeadcount =
              data.headcount ??
              data.current ??
              data.occupied ??
              data.currentCount;
            const rawAvailableSlots =
              data.availableSlots ?? data.remainingSlots ?? data.slotsAvailable;

            const capacity = Number(rawCapacity);
            const headcount = Number(rawHeadcount);
            const availableSlots = Number(rawAvailableSlots);
            const normalizedCapacity =
              Number.isFinite(capacity) && capacity >= 0
                ? Math.floor(capacity)
                : 0;
            const normalizedHeadcount =
              Number.isFinite(headcount) && headcount >= 0
                ? Math.floor(headcount)
                : Number.isFinite(availableSlots) && availableSlots >= 0
                  ? Math.max(0, normalizedCapacity - Math.floor(availableSlots))
                  : 0;
            const boundedHeadcount = Math.max(
              0,
              Math.min(normalizedHeadcount, Math.max(0, normalizedCapacity)),
            );
            const boundedAvailableSlots = Math.max(
              0,
              Number.isFinite(availableSlots) && availableSlots >= 0
                ? Math.floor(availableSlots)
                : normalizedCapacity - boundedHeadcount,
            );

            return {
              id: snapshotDoc.id,
              centerId: data.centerId ?? snapshotDoc.id,
              centerName: data.centerName || data.name || "Evacuation Center",
              address: data.address || data.location || "Location unavailable",
              capacity: normalizedCapacity,
              headcount: boundedHeadcount,
              availableSlots: boundedAvailableSlots,
              updatedAt: data.updatedAt || null,
            };
          })
          .sort((a, b) => {
            const aTime = a.updatedAt?.toDate
              ? a.updatedAt.toDate().getTime()
              : 0;
            const bTime = b.updatedAt?.toDate
              ? b.updatedAt.toDate().getTime()
              : 0;
            return bTime - aTime;
          });

        this.setState({
          evacuationUpdates: updates,
          evacuationUpdatesError: "",
        });
      },
      (error) => {
        console.error("Failed to load evacuation updates:", error);
        this.setState({
          evacuationUpdates: [],
          evacuationUpdatesError:
            "Unable to load evacuation center updates right now.",
        });
      },
    );
  }

  async resolveLocationLabelFromCoordinates(latitude, longitude) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          latitude,
        )}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`,
      );

      if (!response.ok) {
        return "Pinned location";
      }

      const data = await response.json();
      return data?.display_name || "Pinned location";
    } catch (error) {
      console.error("Failed to reverse-geocode SOS location:", error);
      return "Pinned location";
    }
  }

  confirmLowAccuracyProceed(accuracyMeters) {
    const accuracyValue = Number(accuracyMeters);

    if (
      !Number.isFinite(accuracyValue) ||
      accuracyValue <= LOW_ACCURACY_THRESHOLD_METERS
    ) {
      return true;
    }

    const roundedAccuracy = Math.round(accuracyValue);
    return window.confirm(
      `GPS accuracy is currently around ${roundedAccuracy}m (target: ≤${LOW_ACCURACY_THRESHOLD_METERS}m). Indoors, location may fall back to Wi-Fi/cellular triangulation, which is less accurate than satellite GPS. Move to an open area for better precision, or press OK to trigger SOS anyway.`,
    );
  }

  resolveCurrentLocation() {
    return new Promise((resolve) => {
      if (!isSecureGeolocationContext()) {
        resolve({
          locationLabel: "Secure context required (HTTPS or localhost)",
          coordinates: null,
        });
        return;
      }

      if (!navigator.geolocation) {
        resolve({
          locationLabel: "Geolocation not supported",
          coordinates: null,
        });
        return;
      }

      let settled = false;
      let watchId = null;
      let settleTimer = null;
      let bestCoords = null;

      const cleanup = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        if (settleTimer) {
          clearTimeout(settleTimer);
        }
      };

      const finalize = async (fallbackLabel = "Location unavailable") => {
        if (settled) return;
        settled = true;
        cleanup();

        if (!bestCoords) {
          resolve({
            locationLabel: fallbackLabel,
            coordinates: null,
          });
          return;
        }

        const locationLabel = await this.resolveLocationLabelFromCoordinates(
          bestCoords.lat,
          bestCoords.lng,
        );

        resolve({
          locationLabel,
          coordinates: { lat: bestCoords.lat, lng: bestCoords.lng },
          accuracyMeters: Number(bestCoords.accuracy),
        });
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const latitude = Number(position.coords.latitude.toFixed(6));
          const longitude = Number(position.coords.longitude.toFixed(6));
          const accuracy =
            Number(position.coords.accuracy) || Number.POSITIVE_INFINITY;

          if (!bestCoords || accuracy < bestCoords.accuracy) {
            bestCoords = {
              lat: latitude,
              lng: longitude,
              accuracy,
            };
          }

          if (accuracy <= 20) {
            finalize();
          }
        },
        (error) => {
          if (error?.code === 1) {
            finalize("Location permission denied");
            return;
          }

          if (error?.code === 2) {
            finalize(
              "Location unavailable. Indoors, Wi-Fi/cellular triangulation may be inaccurate—move to an open area and retry.",
            );
            return;
          }

          if (error?.code === 3) {
            finalize("Location request timed out. Please retry.");
            return;
          }

          finalize();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );

      settleTimer = setTimeout(() => finalize(), 7000);
    });
  }

  async handleTriggerSOS() {
    const {
      sendingSos,
      userName,
      disabilityType,
      medicalNeeds,
      selectedSosDisasterType,
    } = this.state;
    const currentUser = auth.currentUser;

    if (sendingSos || !currentUser) return;

    if (this.getActiveSosForCurrentUser()) {
      alert(
        "You already have an active SOS alert. Resolve the current alert before creating another one.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Trigger SOS now? This will notify responders and share your emergency details.",
    );
    if (!confirmed) return;

    this.setState({ sendingSos: true });

    try {
      const { locationLabel, coordinates, accuracyMeters } =
        await this.resolveCurrentLocation();
      const now = new Date();
      const lat = Number(coordinates?.lat);
      const lng = Number(coordinates?.lng);

      if (!this.confirmLowAccuracyProceed(accuracyMeters)) {
        this.setState({ sendingSos: false });
        return;
      }

      const coordinateLabel =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          : locationLabel;
      const disasterType = String(selectedSosDisasterType || "")
        .trim()
        .toLowerCase();
      const disasterTypeLabel = getDisasterTypeLabel(disasterType);

      await EmergencyEventService.createSosEvent({
        userId: currentUser.uid,
        userName,
        disasterType,
        disasterTypeLabel,
        locationLabel: coordinateLabel,
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
        locationLabel: coordinateLabel,
      });
    } catch (error) {
      console.error("Failed to trigger SOS:", error);
      this.setState({ sendingSos: false });
      alert(
        "Failed to trigger SOS. Confirm location permission is enabled with precise/fine accuracy. If you are indoors, Wi-Fi/cellular triangulation can be less accurate than satellite GPS—try moving to an open area and retry.",
      );
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
    return this.state.evacuationUpdates;
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

  getActiveSosForCurrentUser() {
    const { emergencyEvents, currentUserId } = this.state;
    const resolvedSourceIds = this.getResolvedSourceIds();

    if (!currentUserId) {
      return null;
    }

    return (
      emergencyEvents.find(
        (event) =>
          event.type === "sos" &&
          event.userId === currentUserId &&
          event.status !== "resolved" &&
          event.status !== "stopped" &&
          !resolvedSourceIds.has(event.id),
      ) || null
    );
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
          disasterTypeLabel:
            event.type === "sos"
              ? event.disasterTypeLabel ||
                getDisasterTypeLabel(event.disasterType)
              : "",
          dateTime: this.formatDateTime(event.createdAt),
          status,
          canResolve:
            status === "Active" &&
            event.userId === currentUserId &&
            (event.type === "sos" || event.type === "location-share"),
        };
      });
  }

  handleSosDisasterTypeChange(event) {
    this.setState({
      selectedSosDisasterType: String(event?.target?.value || "")
        .trim()
        .toLowerCase(),
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
      selectedSosDisasterType,
      sosTriggeredAt,
      evacuationUpdatesError,
    } = this.state;

    const announcements = this.getAnnouncements();
    const evacuationUpdates = this.getEvacuationUpdates();
    const alertHistory = this.getAlertHistory();
    const hasActiveSos = Boolean(this.getActiveSosForCurrentUser());
    const activeAlertHistory = alertHistory.filter(
      (item) => item.status === "Active",
    );
    const resolvedAlertHistory = alertHistory.filter(
      (item) => item.status === "Resolved",
    );

    const renderHistoryItem = (item) => (
      <article
        key={item.id}
        className='border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-2'
      >
        <p className='text-xs font-black text-slate-700 uppercase flex items-center gap-2'>
          <FontAwesomeIcon icon={faClockRotateLeft} /> Alert type:{" "}
          {item.typeLabel}
          {item.disasterTypeLabel ? ` (${item.disasterTypeLabel})` : ""}
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
      </article>
    );

    return (
      <section className='space-y-4' aria-labelledby='alerts-page-heading'>
        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h2 id='alerts-page-heading' className='text-xl font-black text-slate-800 uppercase tracking-tight'>
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

          <div className='mt-4 max-w-sm'>
            <label
              htmlFor='alerts-sos-disaster-type'
              className='block text-xs font-black text-slate-700 uppercase mb-1'
            >
              SOS Disaster Type
            </label>
            <select
              id='alerts-sos-disaster-type'
              value={selectedSosDisasterType}
              onChange={this.handleSosDisasterTypeChange}
              className='w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200'
            >
              <option value=''>-- Select disaster type --</option>
              {SOS_DISASTER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className='mt-4 flex items-center gap-3' aria-live='polite'>
            <button
              onClick={this.handleTriggerSOS}
              disabled={
                sendingSos ||
                loading ||
                hasActiveSos ||
                !selectedSosDisasterType
              }
              className='bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-black uppercase hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {sendingSos ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className='mr-2' />
                  Sending SOS...
                </>
              ) : hasActiveSos ? (
                <>
                  <FontAwesomeIcon icon={faCircleCheck} className='mr-2' />
                  SOS Active
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
              announcements.map((announcement) => {
                const announcementDisasterType =
                  announcement.disasterTypeLabel ||
                  (announcement.disasterType
                    ? getDisasterTypeLabel(announcement.disasterType)
                    : "");

                return (
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
                    {announcementDisasterType && (
                      <p className='text-[11px] font-black text-red-600 uppercase mt-2'>
                        Disaster type: {announcementDisasterType}
                      </p>
                    )}
                    <div className='mt-2 text-[11px] font-bold text-slate-500 uppercase flex items-center gap-3'>
                      <span>
                        Timestamp: {this.formatDateTime(announcement.createdAt)}
                      </span>
                      <span>LGU Source: {announcement.userName || "LGU"}</span>
                    </div>
                  </div>
                );
              })
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
            {evacuationUpdatesError ? (
              <div className='border border-red-200 bg-red-50 rounded-xl p-4'>
                <p className='text-xs font-black text-red-700 uppercase flex items-center gap-2'>
                  <FontAwesomeIcon icon={faHouseFloodWater} /> Update Load Error
                </p>
                <p className='text-sm font-semibold text-slate-700 mt-1'>
                  {evacuationUpdatesError}
                </p>
              </div>
            ) : evacuationUpdates.length === 0 ? (
              <div className='border border-amber-200 bg-amber-50 rounded-xl p-4'>
                <p className='text-xs font-black text-amber-700 uppercase flex items-center gap-2'>
                  <FontAwesomeIcon icon={faHouseFloodWater} /> No capacity
                  changes yet
                </p>
              </div>
            ) : (
              evacuationUpdates.map((update) => {
                return (
                  <div
                    key={update.id}
                    className='border border-amber-200 bg-amber-50 rounded-xl p-4'
                  >
                    <p className='text-xs font-black text-amber-700 uppercase flex items-center gap-2'>
                      <FontAwesomeIcon icon={faHouseFloodWater} /> Capacity
                      Update
                    </p>
                    <p className='text-sm font-semibold text-slate-700 mt-1'>
                      Center name: {update.centerName || "Unspecified Center"}
                    </p>
                    <p className='text-sm font-semibold text-slate-700'>
                      Headcount: {update.headcount}
                    </p>
                    <p className='text-sm font-semibold text-slate-700'>
                      Available slots: {update.availableSlots}
                    </p>
                    <p className='text-sm font-semibold text-slate-700'>
                      Capacity: {update.capacity}
                    </p>
                    <p className='text-[11px] font-bold text-slate-500 uppercase mt-2'>
                      {update.address}
                    </p>
                    <div className='mt-2 text-[11px] font-bold text-slate-500 uppercase'>
                      Last updated: {this.formatDateTime(update.updatedAt)}
                    </div>
                  </div>
                );
              })
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
