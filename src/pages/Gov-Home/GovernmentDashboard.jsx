import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRightFromBracket,
  faUsers,
  faShieldHeart,
  faChevronDown,
  faMapMarkedAlt,
  faClipboardList,
  faChartBar,
  faUserShield,
  faSpinner,
  faBell,
} from "@fortawesome/free-solid-svg-icons";
import {
  Map as MapView,
  Marker,
  Source,
  Layer,
  NavigationControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import {
  collection,
  doc,
  getDocsFromServer,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import Header from "../../components/Header";
import AuthService from "../../services/AuthService";
import EmergencyEventService from "../../services/EmergencyEventService";
import GovEvacuationPlansPage from "./GovEvacuationPlansPage";
import GovResponseTeamsPage from "./GovResponseTeamsPage";
import GovRegisteredUsersPage from "./GovRegisteredUsersPage";
import GovReportsPage from "./GovReportsPage";
import {
  getAccessibilityContainerProps,
  normalizeAccessibilitySettings,
} from "../../services/AccessibilityViewUtils";

const MAP_STYLE = {
  version: 8,
  sources: {
    cartoLight: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "cartoLight", type: "raster", source: "cartoLight" }],
};

const ACCURACY_LAYER_STYLE = {
  id: "gov-user-accuracy-circle",
  type: "circle",
  paint: {
    "circle-color": "#60a5fa",
    "circle-opacity": 0.2,
    "circle-stroke-color": "#2563eb",
    "circle-stroke-width": 2,
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      0,
      20,
      ["/", ["get", "accuracy"], 0.075],
    ],
  },
};

function toLngLat(position) {
  if (!Array.isArray(position) || position.length < 2) return null;
  const lat = Number(position[0]);
  const lng = Number(position[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat];
}

function normalizeCenterKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function renderMapPin(color) {
  return (
    <div
      style={{
        backgroundColor: color,
        width: 30,
        height: 30,
        borderRadius: "50%",
        border: "3px solid white",
        boxShadow: "0 10px 22px rgba(15,23,42,0.32)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#ffffff",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

/**
 * GovernmentDashboard - OOP Class-based Component
 * Dashboard for government/LGU users to monitor residents and evacuation centers
 */
class GovernmentDashboard extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      agencyName: "Local Government Unit",
      agencyType: "",
      userId: null,
      activeTab: "dashboard", // dashboard, evacuation-plans, response-teams, registered-users, reports

      // Stats
      stats: {
        totalRegistered: 0,
        pwdCount: 0,
        familyCount: 0,
      },

      // Evacuation Centers with coordinates
      evacuationCenters: [
        {
          id: 1,
          name: "Sta. Maria Covered Court",
          location: "Sta. Maria, Bulacan",
          capacity: 0,
          current: 0,
          status: "available",
          coordinates: [14.8285, 120.9577], // Sta. Maria, Bulacan coordinates
        },
        {
          id: 2,
          name: "Cabuyao Elementary",
          location: "Cabuyao, Sta. Maria, Bulacan",
          capacity: 0,
          current: 0,
          status: "warning",
          coordinates: [14.8325, 120.9647],
        },
        {
          id: 3,
          name: "San Isidro Chapel",
          location: "San Isidro, Sta. Maria, Bulacan",
          capacity: 0,
          current: 0,
          status: "available",
          coordinates: [14.8245, 120.9517],
        },
      ],
      evacuationCenterSummaryRows: [],
      evacuationCapacityError: "",

      // Map center (Sta. Maria, Bulacan)
      mapCenter: [14.8285, 120.9577],
      mapZoom: 14,
      mapDisplayMode: "sector-view",
      userCurrentLocation: null,
      locationAccuracyMeters: null,

      // Registered Users
      registeredUsers: [],
      filteredUsers: [],
      searchTerm: "",
      filterStatus: "all",

      emergencyEvents: [],
      emergencyFeedLoading: true,
      announcementTitle: "",
      announcementText: "",
      announcementTargetGroup: "all",
      announcementType: "normal",
      announcementDisasterType: "",
      postingAnnouncement: false,
      resolvingDisaster: false,
      resolvingSosEventId: null,
      selectedSosEventId: null,
      sosPanelCollapsed: true,
      qrScanValue: "",
      qrScanResult: null,
      qrScanError: "",
      showGovProfileMenu: false,
      accessibilitySettings: {
        screenReader: false,
        highContrast: false,
        largeText: false,
      },

      loading: true,
      error: null,
    };

    this.handleLogout = this.handleLogout.bind(this);
    this.handleBack = this.handleBack.bind(this);
    this.setActiveTab = this.setActiveTab.bind(this);
    this.loadDashboardData = this.loadDashboardData.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.filterUsers = this.filterUsers.bind(this);
    this.startEmergencyFeedListener =
      this.startEmergencyFeedListener.bind(this);
    this.startRegisteredUsersListener =
      this.startRegisteredUsersListener.bind(this);
    this.startEvacuationCapacityListener =
      this.startEvacuationCapacityListener.bind(this);
    this.applyEvacuationCapacitySnapshot =
      this.applyEvacuationCapacitySnapshot.bind(this);
    this.fetchEvacuationCapacityFromServer =
      this.fetchEvacuationCapacityFromServer.bind(this);
    this.getEmergencyEventTimeLabel =
      this.getEmergencyEventTimeLabel.bind(this);
    this.handleAnnouncementTitleInput =
      this.handleAnnouncementTitleInput.bind(this);
    this.handleAnnouncementInput = this.handleAnnouncementInput.bind(this);
    this.handleAnnouncementTargetChange =
      this.handleAnnouncementTargetChange.bind(this);
    this.handleAnnouncementTypeChange =
      this.handleAnnouncementTypeChange.bind(this);
    this.handleAnnouncementDisasterTypeChange =
      this.handleAnnouncementDisasterTypeChange.bind(this);
    this.handlePostAnnouncement = this.handlePostAnnouncement.bind(this);
    this.handleResolveDisaster = this.handleResolveDisaster.bind(this);
    this.handleMapModeChange = this.handleMapModeChange.bind(this);
    this.handleLocateUser = this.handleLocateUser.bind(this);
    this.handleMapLocationFound = this.handleMapLocationFound.bind(this);
    this.handleMapLocationError = this.handleMapLocationError.bind(this);
    this.handleQrScanInputChange = this.handleQrScanInputChange.bind(this);
    this.handleQrLookup = this.handleQrLookup.bind(this);
    this.getEventCoordinates = this.getEventCoordinates.bind(this);
    this.getEventLocationLabel = this.getEventLocationLabel.bind(this);
    this.handleShowResidentPin = this.handleShowResidentPin.bind(this);
    this.startUserProfileListener = this.startUserProfileListener.bind(this);
    this.handleGovProfileMenuToggle =
      this.handleGovProfileMenuToggle.bind(this);
    this.handleGovProfileMenuClose = this.handleGovProfileMenuClose.bind(this);
    this.handleGovDropdownLogout = this.handleGovDropdownLogout.bind(this);
    this.handleResolveSosAlert = this.handleResolveSosAlert.bind(this);
    this.toggleSosPanelCollapsed = this.toggleSosPanelCollapsed.bind(this);
  }

  /**
   * Load dashboard data on mount
   */
  async componentDidMount() {
    const unsubscribe = AuthService.onAuthStateChange(async (user) => {
      if (user) {
        await this.loadDashboardData();
        this.startRegisteredUsersListener();
        this.startEvacuationCapacityListener();
        this.startEmergencyFeedListener();
        this.startUserProfileListener(user.uid);
      }
    });
    this.authUnsubscribe = unsubscribe;
  }

  /**
   * Clean up on unmount
   */
  componentWillUnmount() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }
    if (this.registeredUsersUnsubscribe) {
      this.registeredUsersUnsubscribe();
    }
    if (this.userProfileUnsubscribe) {
      this.userProfileUnsubscribe();
    }
    if (this.capacityUnsubscribe) {
      this.capacityUnsubscribe();
    }
  }

  startRegisteredUsersListener() {
    if (this.registeredUsersUnsubscribe) {
      this.registeredUsersUnsubscribe();
    }

    const usersRef = collection(AuthService.db, "users");
    const residentsQuery = query(usersRef, where("role", "==", "resident"));

    this.registeredUsersUnsubscribe = onSnapshot(
      residentsQuery,
      (snapshot) => {
        const users = [];
        let pwdCount = 0;
        let familyCount = 0;

        snapshot.forEach((userDoc) => {
          const userData = { id: userDoc.id, ...userDoc.data() };
          users.push(userData);

          if (userData.pwdId && userData.pwdId !== "N/A") {
            pwdCount++;
          }
          if (userData.accountType === "residential-family") {
            familyCount++;
          }
        });

        this.setState(
          (prevState) => ({
            stats: {
              ...prevState.stats,
              totalRegistered: users.length,
              pwdCount,
              familyCount,
            },
            registeredUsers: users,
            loading: false,
            error: null,
          }),
          this.filterUsers,
        );
      },
      (error) => {
        console.error("[GovernmentDashboard] Failed to fetch users:", error);
        this.setState({
          error: "Failed to fetch registered users from Firebase.",
          loading: false,
        });
      },
    );
  }

  startEvacuationCapacityListener() {
    if (this.capacityUnsubscribe) {
      this.capacityUnsubscribe();
    }

    const capacityRef = collection(db, "evacuationCenterCapacity");

    this.capacityUnsubscribe = onSnapshot(
      capacityRef,
      (snapshot) => {
        this.applyEvacuationCapacitySnapshot(snapshot);

        if (snapshot.empty) {
          this.fetchEvacuationCapacityFromServer();
        }
      },
      (error) => {
        console.error(
          "[GovernmentDashboard] Failed to auto-load center capacity:",
          error,
        );

        const isPermissionError =
          error?.code === "permission-denied" ||
          String(error?.message || "")
            .toLowerCase()
            .includes("permission-denied");

        this.setState({
          evacuationCapacityError: isPermissionError
            ? "Unable to read evacuationCenterCapacity (permission denied). Check Firestore rules for your government role."
            : "Unable to load evacuationCenterCapacity right now. Please refresh and try again.",
        });
      },
    );
  }

  applyEvacuationCapacitySnapshot(snapshotLike) {
    const updatesByCenterId = new Map();

    snapshotLike.forEach((centerDoc) => {
      const data = centerDoc.data() || {};
      const rawCenterId = data.centerId ?? centerDoc.id;
      const numericCenterId = Number(rawCenterId);
      const centerId = Number.isFinite(numericCenterId)
        ? numericCenterId
        : String(rawCenterId);

      const rawCapacity =
        data.capacity ?? data.maxCapacity ?? data.totalCapacity;
      const directHeadcount =
        data.headcount ?? data.current ?? data.occupied ?? data.currentCount;
      const rawAvailableSlots =
        data.availableSlots ?? data.remainingSlots ?? data.slotsAvailable;
      const centerName = data.centerName || data.name || data.center || "";
      const address = data.address || data.location || data.centerAddress || "";

      const parsedCapacity = Number(rawCapacity);
      const parsedHeadcount = Number(directHeadcount);
      const parsedAvailableSlots = Number(rawAvailableSlots);

      const derivedHeadcount = Number.isFinite(parsedHeadcount)
        ? parsedHeadcount
        : Number.isFinite(parsedCapacity) &&
            Number.isFinite(parsedAvailableSlots)
          ? Math.max(0, parsedCapacity - parsedAvailableSlots)
          : NaN;

      updatesByCenterId.set(String(centerId), {
        centerId,
        name: centerName,
        location: address,
        capacity: parsedCapacity,
        headcount: derivedHeadcount,
      });
    });

    const summaryRows = Array.from(updatesByCenterId.values())
      .map((update) => {
        const nextCapacity =
          Number.isFinite(update.capacity) && update.capacity > 0
            ? Math.floor(update.capacity)
            : 0;
        const rawHeadcount =
          Number.isFinite(update.headcount) && update.headcount >= 0
            ? Math.floor(update.headcount)
            : 0;
        const nextCurrent = Math.max(
          0,
          Math.min(rawHeadcount, Math.max(0, nextCapacity)),
        );

        return {
          id: update.centerId,
          name: update.name || "Evacuation Center",
          capacity: nextCapacity,
          current: nextCurrent,
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    this.setState((prevState) => {
      const updatesByCenterName = new Map();
      updatesByCenterId.forEach((update) => {
        const key = normalizeCenterKey(update.name);
        if (key) {
          updatesByCenterName.set(key, update);
        }
      });

      const merged = prevState.evacuationCenters.map((center) => {
        const update =
          updatesByCenterId.get(String(center.id)) ||
          updatesByCenterName.get(normalizeCenterKey(center.name));
        if (!update) {
          return center;
        }

        const nextCapacity =
          Number.isFinite(update.capacity) && update.capacity > 0
            ? update.capacity
            : 0;
        const rawHeadcount =
          Number.isFinite(update.headcount) && update.headcount >= 0
            ? update.headcount
            : 0;
        const nextCurrent = Math.max(
          0,
          Math.min(rawHeadcount, Math.max(0, nextCapacity)),
        );
        const occupancy = nextCapacity > 0 ? nextCurrent / nextCapacity : 0;

        return {
          ...center,
          location: update.location || center.location,
          capacity: nextCapacity,
          current: nextCurrent,
          status:
            occupancy >= 0.95
              ? "critical"
              : occupancy >= 0.85
                ? "warning"
                : "available",
        };
      });

      const existingIds = new Set(merged.map((center) => String(center.id)));
      const appended = [];

      updatesByCenterId.forEach((update) => {
        if (existingIds.has(String(update.centerId))) {
          return;
        }

        const nextCapacity =
          Number.isFinite(update.capacity) && update.capacity > 0
            ? update.capacity
            : 0;
        const rawHeadcount =
          Number.isFinite(update.headcount) && update.headcount >= 0
            ? update.headcount
            : 0;
        const nextCurrent = Math.max(
          0,
          Math.min(rawHeadcount, Math.max(0, nextCapacity)),
        );
        const occupancy = nextCapacity > 0 ? nextCurrent / nextCapacity : 0;

        appended.push({
          id: update.centerId,
          name: update.name || "Evacuation Center",
          location: update.location || "Unknown location",
          capacity: nextCapacity,
          current: nextCurrent,
          status:
            occupancy >= 0.95
              ? "critical"
              : occupancy >= 0.85
                ? "warning"
                : "available",
          coordinates: prevState.mapCenter,
        });
      });

      return {
        evacuationCenters: [...merged, ...appended],
        evacuationCenterSummaryRows: summaryRows,
        evacuationCapacityError: "",
      };
    });
  }

  async fetchEvacuationCapacityFromServer() {
    try {
      const snapshot = await getDocsFromServer(
        collection(db, "evacuationCenterCapacity"),
      );

      if (!snapshot.empty) {
        this.applyEvacuationCapacitySnapshot(snapshot);
      }
    } catch (error) {
      console.error(
        "[GovernmentDashboard] Failed to fetch center capacity from server:",
        error,
      );
    }
  }

  startUserProfileListener(userId) {
    if (!userId) return;

    if (this.userProfileUnsubscribe) {
      this.userProfileUnsubscribe();
    }

    const userRef = doc(AuthService.db, "users", userId);
    this.userProfileUnsubscribe = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const userData = snapshot.data();

      this.setState({
        accessibilitySettings: normalizeAccessibilitySettings(
          userData?.accessibilitySettings,
        ),
      });
    });
  }

  startEmergencyFeedListener() {
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }

    this.emergencyFeedUnsubscribe =
      EmergencyEventService.subscribeToRecentEvents((events) => {
        this.setState({
          emergencyEvents: events,
          emergencyFeedLoading: false,
        });
      }, 40);
  }

  getEmergencyEventTimeLabel(event) {
    const rawDate = event.createdAt?.toDate
      ? event.createdAt.toDate()
      : event.createdAt;

    if (!(rawDate instanceof Date)) {
      return "just now";
    }

    return rawDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  handleAnnouncementInput(event) {
    this.setState({ announcementText: event.target.value });
  }

  handleAnnouncementTitleInput(event) {
    this.setState({ announcementTitle: event.target.value });
  }

  handleAnnouncementTargetChange(event) {
    this.setState({ announcementTargetGroup: event.target.value });
  }

  handleAnnouncementTypeChange(event) {
    this.setState({ announcementType: event.target.value });
  }

  handleAnnouncementDisasterTypeChange(event) {
    this.setState({ announcementDisasterType: event.target.value });
  }

  async handleResolveDisaster(disasterEventId) {
    if (!disasterEventId || this.state.resolvingDisaster) {
      alert("No valid disaster event ID. Cannot resolve.");
      return;
    }
    const confirmed = window.confirm(
      "Mark this disaster announcement as resolved and deactivate Disaster Mode?",
    );
    if (!confirmed) return;
    this.setState({ resolvingDisaster: true });
    try {
      const eventRef = doc(db, "emergencyEvents", disasterEventId);
      await updateDoc(eventRef, { status: "resolved" });
      // Optionally reload dashboard data after resolving
      if (typeof this.loadDashboardData === "function") {
        await this.loadDashboardData();
      }
    } catch (error) {
      console.error("Failed to resolve disaster announcement:", error);
      alert(
        "Failed to resolve disaster. Firestore error: " +
          (error && error.message ? error.message : String(error))
      );
    } finally {
      this.setState({ resolvingDisaster: false });
    }
  }

  handleMapModeChange(mode) {
    this.setState({ mapDisplayMode: mode });
  }

  handleLocateUser() {
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

    const finalize = () => {
      if (settled) return;
      settled = true;
      cleanup();

      if (!bestCoords) {
        this.handleMapLocationError();
        return;
      }

      this.handleMapLocationFound(bestCoords);
    };

    if (!navigator.geolocation) {
      this.handleMapLocationError();
      return;
    }

    this.setState({ userCurrentLocation: null, locationAccuracyMeters: null });

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const accuracy =
          Number(position.coords.accuracy) || Number.POSITIVE_INFINITY;

        if (!bestCoords || accuracy < bestCoords.accuracy) {
          bestCoords = { lat, lng, accuracy };
        }

        if (accuracy <= 20) {
          finalize();
        }
      },
      (error) => {
        if (error?.code === 1) {
          finalize();
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );

    settleTimer = setTimeout(() => finalize(), 7000);
  }

  handleMapLocationFound(locationData) {
    if (!locationData) return;

    const lat = Number(locationData.lat);
    const lng = Number(locationData.lng);
    const accuracy = Number(locationData.accuracy);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    this.setState((prevState) => {
      const prevAccuracy = Number(prevState.locationAccuracyMeters);
      const hasBetterAccuracy =
        !Number.isFinite(prevAccuracy) ||
        !Number.isFinite(accuracy) ||
        accuracy <= prevAccuracy;

      if (!hasBetterAccuracy) {
        return null;
      }

      return {
        mapCenter: [lat, lng],
        userCurrentLocation: [lat, lng],
        locationAccuracyMeters: Number.isFinite(accuracy)
          ? Math.round(accuracy)
          : null,
      };
    });
  }

  handleMapLocationError() {
    alert(
      "Unable to determine current location. Please allow location access and try again.",
    );
  }

  handleQrScanInputChange(event) {
    this.setState({ qrScanValue: event.target.value, qrScanError: "" });
  }

  handleQrLookup() {
    const { qrScanValue, registeredUsers } = this.state;
    const normalizedValue = qrScanValue.trim();

    if (!normalizedValue) {
      this.setState({
        qrScanResult: null,
        qrScanError: "Enter a QR value, user ID, or email.",
      });
      return;
    }

    const lowerValue = normalizedValue.toLowerCase();
    const matchedUser = registeredUsers.find((user) => {
      const qrValue = String(user.profileQrCode || "").toLowerCase();
      const uidValue = String(user.uid || user.id || "").toLowerCase();
      const emailValue = String(user.email || "").toLowerCase();
      return (
        qrValue === lowerValue ||
        uidValue === lowerValue ||
        emailValue === lowerValue
      );
    });

    if (!matchedUser) {
      this.setState({
        qrScanResult: null,
        qrScanError: "No registered user matched that QR value.",
      });
      return;
    }

    this.setState({
      qrScanResult: matchedUser,
      qrScanError: "",
    });
  }

  getEventCoordinates(event) {
    const lat = Number(
      event?.coordinates?.lat ??
        event?.coordinates?.latitude ??
        event?.lat ??
        event?.latitude,
    );
    const lng = Number(
      event?.coordinates?.lng ??
        event?.coordinates?.lon ??
        event?.coordinates?.longitude ??
        event?.lng ??
        event?.lon ??
        event?.longitude,
    );

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }

    if (Array.isArray(event?.coordinates) && event.coordinates.length >= 2) {
      const arrayLat = Number(event.coordinates[0]);
      const arrayLng = Number(event.coordinates[1]);
      if (Number.isFinite(arrayLat) && Number.isFinite(arrayLng)) {
        return [arrayLat, arrayLng];
      }
    }

    const rawLabel = String(event?.locationLabel || "").trim();
    const labelMatch = rawLabel.match(
      /lat\s*(-?\d+(?:\.\d+)?)\s*,\s*lng\s*(-?\d+(?:\.\d+)?)/i,
    );
    if (labelMatch) {
      const labelLat = Number(labelMatch[1]);
      const labelLng = Number(labelMatch[2]);
      if (Number.isFinite(labelLat) && Number.isFinite(labelLng)) {
        return [labelLat, labelLng];
      }
    }

    const plainPairMatch = rawLabel.match(
      /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
    );
    if (plainPairMatch) {
      const labelLat = Number(plainPairMatch[1]);
      const labelLng = Number(plainPairMatch[2]);
      if (Number.isFinite(labelLat) && Number.isFinite(labelLng)) {
        return [labelLat, labelLng];
      }
    }

    return null;
  }

  getEventLocationLabel(event) {
    const coordinates = this.getEventCoordinates(event);
    if (coordinates) {
      return `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`;
    }

    return "Location not shared";
  }

  handleShowResidentPin(coordinates, eventId) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return;
    }

    const lat = Number(coordinates[0]);
    const lng = Number(coordinates[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    this.setState({
      mapDisplayMode: "sos-view",
      mapCenter: [lat, lng],
      mapZoom: Math.max(Number(this.state.mapZoom) || 14, 16),
      selectedSosEventId: eventId || null,
    });
  }

  toggleSosPanelCollapsed() {
    this.setState((prev) => ({ sosPanelCollapsed: !prev.sosPanelCollapsed }));
  }

  async handleResolveSosAlert(event) {
    const { resolvingSosEventId, userId, agencyName } = this.state;

    if (!event?.id || resolvingSosEventId || !userId) return;

    const confirmed = window.confirm("Mark this SOS alert as resolved?");
    if (!confirmed) return;

    this.setState({ resolvingSosEventId: event.id });

    try {
      await EmergencyEventService.createResolutionEvent({
        userId,
        userName: agencyName || "Local Government Unit",
        sourceEventId: event.id,
        sourceType: event.type || "sos",
        resolutionNote: "Resolved by government",
      });
      this.setState({ resolvingSosEventId: null });
    } catch (error) {
      console.error("Failed to resolve SOS alert:", error);
      this.setState({ resolvingSosEventId: null });
      alert("Failed to resolve SOS alert. Please try again.");
    }
  }

  async handlePostAnnouncement() {
    const {
      announcementTitle,
      announcementText,
      announcementTargetGroup,
      announcementType,
      announcementDisasterType,
      userId,
      agencyName,
      postingAnnouncement,
    } = this.state;

    if (postingAnnouncement) return;

    const title = announcementTitle.trim();
    const message = announcementText.trim();
    if (!title || !message) return;

    this.setState({ postingAnnouncement: true });

    try {
      await EmergencyEventService.createAnnouncementEvent({
        userId,
        userName: agencyName || "Local Government Unit",
        alertTitle: title,
        targetGroup: announcementTargetGroup,
        category: announcementTargetGroup === "all" ? "general" : "sector",
        announcementType,
        disasterType:
          announcementType === "disaster" ? announcementDisasterType : "",
        message,
      });
      this.setState({
        announcementTitle: "",
        announcementText: "",
        announcementTargetGroup: "all",
        announcementType: "normal",
        announcementDisasterType: "",
        postingAnnouncement: false,
      });
    } catch (error) {
      console.error("Failed to post announcement:", error);
      this.setState({ postingAnnouncement: false });
      alert("Failed to post announcement. Please try again.");
    }
  }

  /**
   * Load all dashboard data
   * @private
   */
  async loadDashboardData() {
    this.setState({ loading: true, error: null });

    try {
      const currentUser = AuthService.auth.currentUser;

      if (!currentUser) {
        throw new Error("No authenticated user found.");
      }

      const userData = await AuthService.getUserData(currentUser.uid);

      if (!userData) {
        throw new Error("User data not found.");
      }

      this.setState({
        agencyName: userData.agencyName || "Local Government Unit",
        agencyType: userData.agencyType || "",
        userId: currentUser.uid,
        loading: true,
      });
    } catch (error) {
      console.error("[GovernmentDashboard] Failed to load data:", error);
      this.setState({
        error: "Failed to load dashboard data. Please try again.",
        loading: false,
      });
    }
  }

  /**
   * Handle logout
   * @private
   */
  async handleLogout() {
    try {
      await AuthService.logout();
      if (this.props.onLogout) {
        this.props.onLogout();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  handleGovProfileMenuToggle(event) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }

    this.setState((prevState) => ({
      showGovProfileMenu: !prevState.showGovProfileMenu,
    }));
  }

  handleGovProfileMenuClose(event) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }

    this.setState({ showGovProfileMenu: false });
  }

  async handleGovDropdownLogout(event) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }

    this.setState({ showGovProfileMenu: false });
    await this.handleLogout();
  }

  /**
   * Handle back navigation
   * @private
   */
  handleBack() {
    if (this.props.onBack) {
      this.props.onBack();
    }
  }

  /**
   * Set active tab
   * @private
   */
  setActiveTab(tab) {
    this.setState({ activeTab: tab });
  }

  /**
   * Handle search input
   * @private
   */
  handleSearch(e) {
    const searchTerm = e.target.value;
    this.setState({ searchTerm }, () => {
      this.filterUsers();
    });
  }

  /**
   * Handle filter change
   * @private
   */
  handleFilterChange(e) {
    const filterStatus = e.target.value;
    this.setState({ filterStatus }, () => {
      this.filterUsers();
    });
  }

  /**
   * Filter users based on search and filter
   * @private
   */
  filterUsers() {
    const { registeredUsers, searchTerm, filterStatus } = this.state;
    let filtered = registeredUsers;

    // Apply status filter
    if (filterStatus === "pwd") {
      filtered = filtered.filter((user) => user.pwdId && user.pwdId !== "N/A");
    } else if (filterStatus === "family") {
      filtered = filtered.filter(
        (user) => user.accountType === "residential-family",
      );
    } else if (filterStatus === "individual") {
      filtered = filtered.filter((user) => user.accountType === "individual");
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.phone?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    this.setState({ filteredUsers: filtered });
  }

  /**
   * Get capacity status color
   * @private
   */
  getCapacityColor(current, capacity) {
    const percentage = (current / capacity) * 100;
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-orange-500";
    return "bg-green-500";
  }

  /**
   * Get marker color based on capacity
   * @private
   */
  getMarkerColor(current, capacity) {
    const percentage = (current / capacity) * 100;
    if (percentage >= 90) return "#ef4444"; // red
    if (percentage >= 70) return "#f97316"; // orange
    return "#22c55e"; // green
  }

  /**
   * Render dashboard view
   * @private
   */
  renderDashboard() {
    const {
      stats,
      evacuationCenters,
      registeredUsers,
      filteredUsers,
      emergencyEvents,
      emergencyFeedLoading,
      announcementTitle,
      announcementText,
      announcementTargetGroup,
      announcementType,
      announcementDisasterType,
      postingAnnouncement,
      resolvingDisaster,
      mapDisplayMode,
      mapCenter,
      mapZoom,
      userCurrentLocation,
      locationAccuracyMeters,
      qrScanValue,
      qrScanResult,
      qrScanError,
      resolvingSosEventId,
      selectedSosEventId,
      evacuationCenterSummaryRows,
      evacuationCapacityError,
      sosPanelCollapsed,
    } = this.state;
    const recentFeedEvents = emergencyEvents.slice(0, 8);
    const evacuationCenterLogs = emergencyEvents
      .filter((event) => event.type === "evacuation-arrival")
      .slice(0, 12);
    const resolvedSourceEventIds = new Set(
      emergencyEvents
        .filter((event) => event.type === "resolution" && event.sourceEventId)
        .map((event) => event.sourceEventId),
    );

    const activeSosEvents = emergencyEvents
      .filter((event) => event.type === "sos")
      .filter(
        (event) =>
          event.status !== "resolved" && !resolvedSourceEventIds.has(event.id),
      );

    const activeDisasterAnnouncements = emergencyEvents.filter(
      (event) =>
        event.type === "announcement" &&
        event.announcementType === "disaster" &&
        event.status !== "resolved" &&
        !resolvedSourceEventIds.has(event.id),
    );
    const activeDisasterAnnouncement = activeDisasterAnnouncements[0] || null;

    const getUserByEvent = (event) =>
      filteredUsers.find(
        (user) => user.id === event.userId || user.uid === event.userId,
      );

    const getDisabilityLabel = (user, event) => {
      if (event?.disabilityType) {
        return event.disabilityType;
      }

      if (
        Array.isArray(user?.selectedDisabilities) &&
        user.selectedDisabilities.length
      ) {
        return user.selectedDisabilities.join(", ");
      }

      const disabilityMap = user?.disabilities || {};
      const activeDisabilities = Object.keys(disabilityMap).filter(
        (key) => disabilityMap[key],
      );

      return activeDisabilities.length
        ? activeDisabilities.join(", ")
        : "Not specified";
    };

    const getMedicalNeeds = (user, event) => {
      if (event?.medicalNeeds) return event.medicalNeeds;
      if (user?.medicalInfo) return user.medicalInfo;
      if (user?.bloodType) return `Blood Type: ${user.bloodType}`;
      return "No medical data on record";
    };

    const disasterModeStatus =
      activeSosEvents.length > 0 || activeDisasterAnnouncement
        ? "Activated"
        : "Standby";

    const getSectorLabel = (location) => {
      if (!location || typeof location !== "string") return "Unknown Location";
      return location.trim();
    };

    const getBarangayMatchKey = (location) => {
      if (!location || typeof location !== "string") return "";
      return location.split(",")[0]?.trim() || "";
    };

    const barangayHeatmap = evacuationCenters.map((center) => {
      const sectorLabel = getSectorLabel(center.location);
      const matchKey = getBarangayMatchKey(center.location);
      const residentsInBarangay = registeredUsers.filter((user) =>
        String(user.address || "")
          .toLowerCase()
          .includes(matchKey.toLowerCase()),
      );
      const pwdClusterCount = residentsInBarangay.filter(
        (user) => user.pwdId && user.pwdId !== "N/A",
      ).length;

      return {
        ...center,
        sectorLabel,
        residentsCount: residentsInBarangay.length,
        pwdClusterCount,
      };
    });

    const effectiveMapMode = mapDisplayMode;

    return (
      <>
        <div className='bg-white rounded-lg shadow-sm p-5 mb-6 border border-gray-200'>
          <p className='text-xs font-black text-[#3a4a5b] uppercase mb-4'>
            System Summary
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
            <div className='rounded-lg border border-gray-200 bg-gray-50 px-4 py-3'>
              <p className='text-[11px] font-bold text-gray-500 uppercase'>
                Total Residents
              </p>
              <p className='text-2xl font-black text-[#3a4a5b] mt-1'>
                {stats.totalRegistered}
              </p>
            </div>
            <div className='rounded-lg border border-gray-200 bg-gray-50 px-4 py-3'>
              <p className='text-[11px] font-bold text-gray-500 uppercase'>
                Total PWDs
              </p>
              <p className='text-2xl font-black text-[#3a4a5b] mt-1'>
                {stats.pwdCount}
              </p>
            </div>
            <div className='rounded-lg border border-gray-200 bg-gray-50 px-4 py-3'>
              <p className='text-[11px] font-bold text-gray-500 uppercase'>
                Active SOS
              </p>
              <p className='text-2xl font-black text-red-600 mt-1'>
                {activeSosEvents.length}
              </p>
            </div>
            <div className='rounded-lg border border-gray-200 bg-gray-50 px-4 py-3'>
              <p className='text-[11px] font-bold text-gray-500 uppercase'>
                Disaster Mode
              </p>
              <p
                className={`text-2xl font-black mt-1 ${
                  disasterModeStatus === "Activated"
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {disasterModeStatus}
              </p>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6'>
          <div className='xl:col-span-8 bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex gap-2'>
                <button
                  type='button'
                  onClick={() => this.handleMapModeChange("sector-view")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                    effectiveMapMode === "sector-view"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Sector View
                </button>
                <button
                  type='button'
                  onClick={() => this.handleMapModeChange("sos-view")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                    effectiveMapMode === "sos-view"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  SOS View
                </button>
                <button
                  type='button'
                  onClick={() => this.handleMapModeChange("evacuation-view")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                    effectiveMapMode === "evacuation-view"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Evacuation View
                </button>
              </div>
            </div>

            <div className='rounded-lg h-110 overflow-hidden border border-gray-200'>
              <MapView
                mapLib={maplibregl}
                mapStyle={MAP_STYLE}
                longitude={mapCenter[1]}
                latitude={mapCenter[0]}
                zoom={mapZoom}
                onMove={(event) => {
                  const { latitude, longitude, zoom } = event.viewState;
                  this.setState({
                    mapCenter: [latitude, longitude],
                    mapZoom: zoom,
                  });
                }}
                style={{ height: "100%", width: "100%" }}
                scrollZoom={true}
              >
                <NavigationControl position='bottom-right' />

                {userCurrentLocation && (
                  <Marker
                    longitude={userCurrentLocation[1]}
                    latitude={userCurrentLocation[0]}
                    anchor='center'
                  >
                    <div className='w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow' />
                  </Marker>
                )}

                {userCurrentLocation &&
                  Number.isFinite(locationAccuracyMeters) && (
                    <Source
                      id='gov-user-accuracy'
                      type='geojson'
                      data={{
                        type: "FeatureCollection",
                        features: [
                          {
                            type: "Feature",
                            properties: { accuracy: locationAccuracyMeters },
                            geometry: {
                              type: "Point",
                              coordinates: [
                                Number(userCurrentLocation[1]),
                                Number(userCurrentLocation[0]),
                              ],
                            },
                          },
                        ],
                      }}
                    >
                      <Layer {...ACCURACY_LAYER_STYLE} />
                    </Source>
                  )}

                {effectiveMapMode === "sector-view" &&
                  barangayHeatmap.map((barangayItem) => {
                    const densityRatio = Math.min(
                      1,
                      (barangayItem.pwdClusterCount || 1) /
                        Math.max(1, stats.pwdCount || 1),
                    );
                    const color =
                      densityRatio >= 0.66
                        ? "#ef4444"
                        : densityRatio >= 0.33
                          ? "#f97316"
                          : "#22c55e";
                    const lngLat = toLngLat(barangayItem.coordinates);
                    if (!lngLat) return null;

                    return (
                      <Marker
                        key={`sector-${barangayItem.id}`}
                        longitude={lngLat[0]}
                        latitude={lngLat[1]}
                        anchor='bottom'
                      >
                        <div className='flex flex-col items-center gap-1'>
                          <div className='map-pin-label map-pin-label--full'>
                            {barangayItem.sectorLabel}
                          </div>
                          {renderMapPin(color)}
                        </div>
                      </Marker>
                    );
                  })}

                {effectiveMapMode === "sos-view" &&
                  activeSosEvents.map((event, index) => {
                    const coordinates = this.getEventCoordinates(event);
                    const lngLat = toLngLat(coordinates);
                    if (!lngLat) return null;
                    const isSelected =
                      event.id && event.id === selectedSosEventId;

                    return (
                      <Marker
                        key={`sos-${event.id || index}`}
                        longitude={lngLat[0]}
                        latitude={lngLat[1]}
                        anchor='bottom'
                      >
                        <div className='flex flex-col items-center gap-1'>
                          <div
                            className='map-pin-label map-pin-label--full'
                            style={
                              isSelected
                                ? {
                                    background: "#dc2626",
                                    color: "#fff",
                                    fontWeight: 800,
                                  }
                                : {}
                            }
                          >
                            {event.userName || "SOS Alert"}
                          </div>
                          {isSelected ? (
                            <div
                              style={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  width: 52,
                                  height: 52,
                                  borderRadius: "50%",
                                  border: "3px solid #dc2626",
                                  opacity: 0.5,
                                  animation:
                                    "gov-pin-pulse 1.4s ease-out infinite",
                                }}
                              />
                              <div
                                style={{
                                  backgroundColor: "#dc2626",
                                  width: 36,
                                  height: 36,
                                  borderRadius: "50%",
                                  border: "3px solid white",
                                  boxShadow:
                                    "0 0 0 4px rgba(220,38,38,0.35), 0 8px 20px rgba(220,38,38,0.5)",
                                  position: "relative",
                                  zIndex: 1,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <div
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    background: "#fff",
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            renderMapPin("#dc2626")
                          )}
                        </div>
                      </Marker>
                    );
                  })}
                <style>{`
                  @keyframes gov-pin-pulse {
                    0%   { transform: scale(0.85); opacity: 0.7; }
                    70%  { transform: scale(1.6);  opacity: 0; }
                    100% { transform: scale(0.85); opacity: 0; }
                  }
                `}</style>

                {effectiveMapMode === "evacuation-view" &&
                  evacuationCenters.map((center) => {
                    const lngLat = toLngLat(center.coordinates);
                    if (!lngLat) return null;

                    return (
                      <Marker
                        key={`center-${center.id}`}
                        longitude={lngLat[0]}
                        latitude={lngLat[1]}
                        anchor='bottom'
                      >
                        <div className='flex flex-col items-center gap-1'>
                          <div className='map-pin-label map-pin-label--full'>
                            {center.name}
                          </div>
                          {renderMapPin(
                            this.getMarkerColor(
                              center.current,
                              center.capacity,
                            ),
                          )}
                        </div>
                      </Marker>
                    );
                  })}
              </MapView>
            </div>
          </div>

          <div className='xl:col-span-4 space-y-6'>
            <div>
              <div className='bg-white rounded-lg shadow-sm p-2 border border-gray-200 mb-2 w-fit'>
                <button
                  className='relative focus:outline-none'
                  onClick={this.toggleSosPanelCollapsed}
                  title={
                    sosPanelCollapsed ? "Show SOS Panel" : "Hide SOS Panel"
                  }
                >
                  <FontAwesomeIcon
                    icon={faBell}
                    className='text-red-600'
                    size='sm'
                  />
                  {activeSosEvents && activeSosEvents.length > 0 && (
                    <span className='absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5'>
                      {activeSosEvents.length}
                    </span>
                  )}
                </button>
              </div>

              {!sosPanelCollapsed && (
                <div className='bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
                  <h3 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
                    SOS Panel
                  </h3>

                  {emergencyFeedLoading ? (
                    <div className='text-center py-5'>
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        className='text-gray-400 text-lg'
                      />
                    </div>
                  ) : activeSosEvents.length === 0 ? (
                    <p className='text-sm text-gray-500'>
                      No active SOS alerts.
                    </p>
                  ) : (
                    <div className='space-y-2 max-h-80 overflow-y-auto pr-1'>
                      {activeSosEvents.slice(0, 8).map((event) => {
                        const user = getUserByEvent(event);
                        const coordinates = this.getEventCoordinates(event);
                        const isSelected =
                          event.id && event.id === selectedSosEventId;

                        return (
                          <div
                            key={event.id}
                            className={`rounded-lg border px-3 py-2 transition-colors ${
                              isSelected
                                ? "border-red-500 bg-red-100 ring-2 ring-red-400"
                                : "border-red-100 bg-red-50"
                            }`}
                          >
                            <p className='text-xs font-black text-red-700 uppercase'>
                              {event.userName || user?.fullName || "Resident"}
                            </p>
                            {event.disasterTypeLabel || event.disasterType ? (
                              <p className='text-[11px] mt-1'>
                                <span
                                  className='inline-block px-2 py-0.5 rounded-full text-white font-bold uppercase tracking-wide'
                                  style={{
                                    backgroundColor: "#dc2626",
                                    fontSize: "0.65rem",
                                  }}
                                >
                                  {event.disasterTypeLabel ||
                                    event.disasterType}
                                </span>
                              </p>
                            ) : null}
                            <p className='text-[11px] text-gray-700 mt-1'>
                              <span className='font-bold'>Location:</span>{" "}
                              {this.getEventLocationLabel(event)}
                            </p>
                            <p className='text-[11px] text-gray-700'>
                              <span className='font-bold'>
                                Disability Type:
                              </span>{" "}
                              {getDisabilityLabel(user, event)}
                            </p>
                            <p className='text-[11px] text-gray-700'>
                              <span className='font-bold'>Medical Needs:</span>{" "}
                              {getMedicalNeeds(user, event)}
                            </p>
                            <button
                              type='button'
                              onClick={() => this.handleResolveSosAlert(event)}
                              disabled={resolvingSosEventId === event.id}
                              className='mt-2 px-3 py-1.5 bg-red-600 text-white rounded text-[11px] font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              {resolvingSosEventId === event.id
                                ? "Resolving..."
                                : "Resolve SOS"}
                            </button>
                            <button
                              type='button'
                              onClick={() =>
                                this.handleShowResidentPin(
                                  coordinates,
                                  event.id,
                                )
                              }
                              disabled={!coordinates}
                              className={`mt-2 ml-2 inline-block px-3 py-1.5 rounded text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                                isSelected
                                  ? "bg-red-600 text-white hover:bg-red-700"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                            >
                              {isSelected ? "Pinned ✓" : "Show Pin"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className='bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
              <h3 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
                QR Scanner
              </h3>
              <p className='text-xs text-gray-500 mb-3'>
                Scan any registered QR
              </p>

              <div className='space-y-2'>
                <input
                  type='text'
                  value={qrScanValue}
                  onChange={this.handleQrScanInputChange}
                  placeholder='Enter QR value, user ID, or email...'
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
                <button
                  type='button'
                  onClick={this.handleQrLookup}
                  className='w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700'
                >
                  Lookup
                </button>
              </div>

              {qrScanError && (
                <p className='text-xs text-red-600 mt-3 font-semibold'>
                  {qrScanError}
                </p>
              )}

              {qrScanResult && (
                <div className='mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1'>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Identity:</span>{" "}
                    {qrScanResult.fullName || "Unknown User"}
                  </p>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Medical Info:</span>{" "}
                    {qrScanResult.medicalInfo ||
                      (qrScanResult.bloodType
                        ? `Blood Type: ${qrScanResult.bloodType}`
                        : "No medical info")}
                  </p>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Accessibility Needs:</span>{" "}
                    {qrScanResult.disabilityNotes ||
                      qrScanResult.accessibilityNeeds ||
                      "Not specified"}
                  </p>
                  <p className='text-xs text-gray-700'>
                    <span className='font-bold'>Emergency Contacts:</span>{" "}
                    {qrScanResult.emergencyContactNumber ||
                      qrScanResult.contact ||
                      qrScanResult.phone ||
                      "Not provided"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200'>
          {activeDisasterAnnouncement && (
            <div className='flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-300 px-4 py-3 mb-4'>
              <div className='flex items-center gap-3 min-w-0'>
                <span className='flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse' />
                <div className='min-w-0'>
                  <p className='text-xs font-black text-red-700 uppercase tracking-wide'>
                    Disaster Mode Active
                  </p>
                  <p className='text-sm font-semibold text-red-900 truncate'>
                    {activeDisasterAnnouncement.alertTitle ||
                      "Disaster Announcement"}
                    {activeDisasterAnnouncement.disasterType ? (
                      <span className='ml-2 text-[11px] font-black text-red-600 uppercase'>
                        —{" "}
                        {String(activeDisasterAnnouncement.disasterType)
                          .charAt(0)
                          .toUpperCase() +
                          String(activeDisasterAnnouncement.disasterType).slice(
                            1,
                          )}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() =>
                  this.handleResolveDisaster(activeDisasterAnnouncement.id)
                }
                disabled={resolvingDisaster}
                className='flex-shrink-0 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-black uppercase hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'
              >
                {resolvingDisaster ? "Resolving..." : "End Disaster"}
              </button>
            </div>
          )}
          <div className='border border-gray-200 rounded-lg p-3 bg-gray-50 mb-4'>
            <p className='text-xs font-black text-[#3a4a5b] uppercase mb-2'>
              Post LGU Announcement
            </p>
            <div className='flex flex-wrap gap-2 mb-2'>
              <select
                value={announcementType}
                onChange={this.handleAnnouncementTypeChange}
                className='px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              >
                <option value='normal'>Normal</option>
                <option value='disaster'>Disaster</option>
              </select>
              {announcementType === "disaster" && (
                <select
                  value={announcementDisasterType}
                  onChange={this.handleAnnouncementDisasterTypeChange}
                  className='px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-sm font-semibold text-red-900 focus:ring-2 focus:ring-red-400 focus:border-transparent'
                >
                  <option value=''>Disaster type...</option>
                  <option value='flood'>Flood</option>
                  <option value='earthquake'>Earthquake</option>
                  <option value='fire'>Fire</option>
                  <option value='landslide'>Landslide</option>
                  <option value='typhoon'>Typhoon</option>
                  <option value='medical'>Medical Emergency</option>
                  <option value='other'>Other</option>
                </select>
              )}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-12 gap-2'>
              <input
                type='text'
                value={announcementTitle}
                onChange={this.handleAnnouncementTitleInput}
                placeholder='Alert title...'
                className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
              <select
                value={announcementTargetGroup}
                onChange={this.handleAnnouncementTargetChange}
                className='md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              >
                <option value='all'>Target: All</option>
                <option value='visual'>Target: Visual</option>
                <option value='hearing'>Target: Hearing</option>
                <option value='mobility'>Target: Mobility</option>
                <option value='cognitive'>Target: Cognitive</option>
                <option value='multiple'>Target: Multiple</option>
              </select>
              <input
                type='text'
                value={announcementText}
                onChange={this.handleAnnouncementInput}
                placeholder='Type official announcement for residents...'
                className='md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
              <button
                onClick={this.handlePostAnnouncement}
                disabled={
                  postingAnnouncement ||
                  !announcementTitle.trim() ||
                  !announcementText.trim() ||
                  (announcementType === "disaster" && !announcementDisasterType)
                }
                className='md:col-span-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {postingAnnouncement ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
          <div className='xl:col-span-7 bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
            <h3 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
              Evac Center Summary
            </h3>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-[11px] font-black uppercase text-gray-500 border-b border-gray-200'>
                    <th className='py-2 pr-2'>Center Name</th>
                    <th className='py-2 pr-2'>Capacity</th>
                    <th className='py-2 pr-2'>Headcount</th>
                    <th className='py-2'>Available Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {evacuationCapacityError ? (
                    <tr>
                      <td className='py-3 text-sm text-red-600' colSpan={4}>
                        {evacuationCapacityError}
                      </td>
                    </tr>
                  ) : evacuationCenterSummaryRows.length === 0 ? (
                    <tr>
                      <td className='py-3 text-sm text-gray-500' colSpan={4}>
                        No capacity records found in evacuationCenterCapacity.
                      </td>
                    </tr>
                  ) : (
                    evacuationCenterSummaryRows.map((center) => {
                      const availableSlots = Math.max(
                        0,
                        center.capacity - center.current,
                      );
                      return (
                        <tr
                          key={`summary-${center.id}`}
                          className='border-b border-gray-100'
                        >
                          <td className='py-2 pr-2 font-semibold text-[#3a4a5b]'>
                            {center.name}
                          </td>
                          <td className='py-2 pr-2 text-gray-700'>
                            {center.capacity}
                          </td>
                          <td className='py-2 pr-2 text-gray-700'>
                            {center.current}
                          </td>
                          <td className='py-2'>
                            <span
                              className={`font-bold ${
                                availableSlots <= 5
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {availableSlots}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className='xl:col-span-5 bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
            <h3 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
              Evacuation Center Logs
            </h3>

            {evacuationCenterLogs.length === 0 ? (
              <p className='text-sm text-gray-500'>
                No evacuation center logs yet.
              </p>
            ) : (
              <div className='space-y-2 max-h-52 overflow-y-auto pr-1'>
                {evacuationCenterLogs.map((event) => {
                  const memberCountRaw = Number(event.memberCount);
                  const memberCount =
                    Number.isFinite(memberCountRaw) && memberCountRaw > 0
                      ? Math.floor(memberCountRaw)
                      : 1;
                  const isDeparture =
                    event.status === "departed" || event.status === "cleared";

                  return (
                    <div
                      key={`evac-log-${event.id}`}
                      className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                    >
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>Resident:</span>{" "}
                        {String(event.userName || "Resident account").trim() ||
                          "Resident account"}
                      </p>
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>Center:</span>{" "}
                        {event.centerName || "Evacuation Center"}
                      </p>
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>Action:</span>{" "}
                        {isDeparture
                          ? "Departure Confirmed"
                          : "Arrival Confirmed"}
                      </p>
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>Members Counted:</span>{" "}
                        {memberCount}
                      </p>
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>Timestamp:</span>{" "}
                        {this.getEmergencyEventTimeLabel(event)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className='mt-4 pt-4 border-t border-gray-200'>
              <h4 className='text-xs font-black text-[#3a4a5b] uppercase mb-2'>
                Audit Log Snapshot
              </h4>

              {recentFeedEvents.length === 0 ? (
                <p className='text-sm text-gray-500'>No recent activity.</p>
              ) : (
                <div className='space-y-2 max-h-40 overflow-y-auto pr-1'>
                  {recentFeedEvents.map((event) => {
                    const isGovernmentResolver =
                      event.role === "government" ||
                      event.accountType === "government" ||
                      String(event.userName || "")
                        .toLowerCase()
                        .includes("government");
                    const resolverDisplayName =
                      String(event.userName || "").trim() ||
                      (isGovernmentResolver
                        ? "Government account"
                        : "Resident account");
                    const actionLabel =
                      event.type === "sos"
                        ? "SOS Triggered"
                        : event.type === "announcement"
                          ? "LGU Announcement Posted"
                          : event.type === "resolution"
                            ? event.resolutionNote ||
                              `Resolved by ${resolverDisplayName}`
                            : event.type === "evacuation-arrival"
                              ? event.status === "departed" ||
                                event.status === "cleared"
                                ? "Departure Confirmed"
                                : "Arrival Confirmed"
                              : "Activity Logged";

                    return (
                      <div
                        key={`audit-${event.id}`}
                        className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                      >
                        <p className='text-xs text-gray-700'>
                          <span className='font-bold'>User Access:</span>{" "}
                          {resolverDisplayName}
                        </p>
                        <p className='text-xs text-gray-700'>
                          <span className='font-bold'>Timestamp:</span>{" "}
                          {this.getEmergencyEventTimeLabel(event)}
                        </p>
                        <p className='text-xs text-gray-700'>
                          <span className='font-bold'>Action:</span>{" "}
                          {actionLabel}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  /**
   * Render tab content
   * @private
   */
  renderTabContent() {
    const {
      activeTab,
      evacuationCenters,
      registeredUsers,
      filteredUsers,
      loading,
      searchTerm,
      filterStatus,
      stats,
      emergencyEvents,
    } = this.state;

    switch (activeTab) {
      case "evacuation-plans":
        return <GovEvacuationPlansPage evacuationCenters={evacuationCenters} />;
      case "response-teams":
        return <GovResponseTeamsPage />;
      case "registered-users":
        return (
          <GovRegisteredUsersPage
            filteredUsers={filteredUsers}
            loading={loading}
            searchTerm={searchTerm}
            filterStatus={filterStatus}
            onSearch={this.handleSearch}
            onFilterChange={this.handleFilterChange}
          />
        );
      case "reports":
        return (
          <GovReportsPage
            stats={stats}
            emergencyEvents={emergencyEvents}
            registeredUsers={registeredUsers}
            evacuationCenters={evacuationCenters}
          />
        );
      case "dashboard":
      default:
        return this.renderDashboard();
    }
  }

  renderHeaderTabItem(icon, label, tabKey, active = false) {
    return (
      <button
        type='button'
        key={tabKey}
        onClick={() => this.setActiveTab(tabKey)}
        className={`flex items-center gap-2 px-5 py-3 min-h-11 text-xs font-bold uppercase rounded-full transition-all whitespace-nowrap ${
          active ? "text-blue-700" : "text-slate-500 hover:text-blue-700"
        }`}
      >
        <FontAwesomeIcon
          icon={icon}
          className={active ? "text-blue-700" : "text-gray-400"}
        />
        <span>{label}</span>
      </button>
    );
  }

  render() {
    const { agencyName, activeTab, accessibilitySettings, showGovProfileMenu } =
      this.state;
    const accessibilityContainer = getAccessibilityContainerProps(
      accessibilitySettings,
    );

    return (
      <div
        className='min-h-screen bg-[#f3f4f6] font-sans'
        style={accessibilityContainer.style}
        aria-live={accessibilityContainer.ariaLive}
      >
        {/* Header Component */}
        <Header
          sticky={true}
          centerContent={
            <>
              {this.renderHeaderTabItem(
                faChartBar,
                "Dashboard",
                "dashboard",
                activeTab === "dashboard",
              )}
              {this.renderHeaderTabItem(
                faMapMarkedAlt,
                "Evacuation Plans",
                "evacuation-plans",
                activeTab === "evacuation-plans",
              )}
              {this.renderHeaderTabItem(
                faUserShield,
                "Response Teams",
                "response-teams",
                activeTab === "response-teams",
              )}
              {this.renderHeaderTabItem(
                faUsers,
                "Registered Users",
                "registered-users",
                activeTab === "registered-users",
              )}
              {this.renderHeaderTabItem(
                faClipboardList,
                "Reports",
                "reports",
                activeTab === "reports",
              )}
            </>
          }
          rightContent={
            <div
              className='relative shrink-0'
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className='flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 pr-3 rounded-full transition-colors'
                onClick={this.handleGovProfileMenuToggle}
              >
                <div className='bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center text-blue-700 border border-blue-200'>
                  <FontAwesomeIcon icon={faShieldHeart} size='lg' />
                </div>
                <div className='text-left'>
                  <p className='text-[9px] font-bold text-gray-400 uppercase leading-none mb-1'>
                    Government Account
                  </p>
                  <p className='text-xs font-black text-[#3a4a5b] leading-none'>
                    {agencyName}
                  </p>
                </div>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`text-[10px] text-gray-400 transition-transform ${
                    showGovProfileMenu ? "rotate-180" : ""
                  }`}
                />
              </div>

              {showGovProfileMenu && (
                <>
                  <div className='hidden lg:block absolute right-0 top-full mt-2 z-2000 profile-dropdown-expandable'>
                    <div className='w-52 bg-white border border-gray-200 rounded-md shadow-xl py-1 overflow-hidden'>
                      <button
                        onClick={this.handleGovDropdownLogout}
                        className='w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
                      </button>
                    </div>
                  </div>

                  <div className='lg:hidden relative mt-2 w-full profile-dropdown-expandable'>
                    <div className='w-full bg-white border border-gray-200 rounded-md shadow-sm py-1 overflow-hidden'>
                      <button
                        onClick={this.handleGovDropdownLogout}
                        className='w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          }
        />

        {/* Main Content */}
        <div className='px-2 py-3 lg:px-3 lg:py-4'>
          <div className='w-full'>
            {/* Page Title */}
            <div className='mb-4'>
              <h1 className='text-3xl font-black text-[#3a4a5b]'>
                Resident Monitoring
              </h1>
              <p className='text-sm text-gray-500 mt-1'>
                Manage evacuation centers and monitor registered users for
                planning
              </p>
            </div>

            {/* Tab Content */}
            {this.renderTabContent()}
          </div>
        </div>
      </div>
    );
  }
}

export default GovernmentDashboard;
