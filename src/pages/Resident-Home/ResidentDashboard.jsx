import React from "react";
import {
  Map as MapView,
  Marker,
  Source,
  Layer,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faAddressBook,
  faShieldHeart,
  faBell,
  faBullhorn,
  faWheelchair,
  faUserGroup,
  faMagnifyingGlass,
  faUserCircle,
  faPenToSquare,
  faRightFromBracket,
  faLocationCrosshairs,
  faTriangleExclamation,
  faRoute,
  faClock,
  faCheckCircle,
  faMapLocationDot,
  faBookOpen,
  faUsersViewfinder,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";

// Firebase imports
import { auth, db } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

// Component imports
import ResidentDashboardHeader from "../../components/ResidentDashboardHeader";
import Header from "../../components/Header";
import ResidentAlerts from "./ResidentAlerts";
import ResidentEvacPlan from "./ResidentEvacPlan";
import ResidentResources from "./ResidentResources";
import ResidentContacts from "./ResidentContacts";
import ResidentSectors from "./ResidentSectors";
import EmergencyEventService from "../../services/EmergencyEventService";
import {
  getAccessibilityContainerProps,
  normalizeAccessibilitySettings,
} from "../../services/AccessibilityViewUtils";

// Constants
const ORIGINAL_CENTER = [120.962, 14.8193];

const GEOLOCATION_POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

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

const SOS_GUIDE_BY_DISASTER = {
  flood: {
    title: "Flood Response Guide",
    steps: [
      "Move to higher ground immediately and avoid rivers, canals, and low roads.",
      "Switch off electricity if water is rising near outlets or appliances.",
      "Keep your go-bag, medicines, charger, and important IDs in a dry bag.",
    ],
  },
  earthquake: {
    title: "Earthquake Response Guide",
    steps: [
      "Drop, cover, and hold on until the shaking stops.",
      "Move away from glass, shelves, and anything that can fall.",
      "After shaking stops, evacuate carefully and watch for aftershocks.",
    ],
  },
  fire: {
    title: "Fire Response Guide",
    steps: [
      "Leave the area immediately using the nearest safe exit.",
      "Stay low if there is smoke and cover your nose and mouth with cloth.",
      "Do not go back inside for belongings once you are out.",
    ],
  },
  landslide: {
    title: "Landslide Response Guide",
    steps: [
      "Move away from slopes, retaining walls, and downhill flow paths.",
      "Watch for falling rocks, tilted trees, and sudden ground movement.",
      "Head to an open, stable area and wait for official clearance.",
    ],
  },
  typhoon: {
    title: "Typhoon Response Guide",
    steps: [
      "Stay indoors or evacuate early if authorities instruct you to do so.",
      "Keep windows secured and stay away from damaged roofs and power lines.",
      "Prepare water, food, flashlights, medicines, and emergency contacts.",
    ],
  },
  medical: {
    title: "Medical Emergency Guide",
    steps: [
      "Stay where responders can reach you quickly unless the area is unsafe.",
      "Keep required medicines, allergy details, and medical records ready.",
      "If possible, contact a caregiver, family member, or nearby responder.",
    ],
  },
  other: {
    title: "Emergency Response Guide",
    steps: [
      "Move to the safest nearby area and stay visible to responders.",
      "Keep your phone charged and maintain contact with trusted support people.",
      "Follow official evacuation or shelter instructions as soon as they arrive.",
    ],
  },
};

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
  id: "user-accuracy-circle",
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

function parseCenterCapacityText(capacityText) {
  const match = String(capacityText || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) {
    return { headcount: 0, capacity: 0 };
  }

  return {
    headcount: Number(match[1]) || 0,
    capacity: Number(match[2]) || 0,
  };
}

function normalizeCenterKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toLngLat(position) {
  if (!Array.isArray(position) || position.length < 2) return null;
  const lng = Number(position[0]);
  const lat = Number(position[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
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

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function renderCenterPin(isFull, mini = false) {
  const size = mini ? 20 : 26;
  const bgColor = isFull ? "#dc2626" : "#2563eb";
  const ringColor = isFull ? "#fecaca" : "#bfdbfe";
  const iconSymbol = isFull ? "!" : "✓";

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "9999px",
        background: bgColor,
        border: `2px solid ${ringColor}`,
        boxShadow: "0 10px 22px rgba(15,23,42,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontWeight: 900,
        fontSize: `${mini ? 11 : 13}px`,
        lineHeight: 1,
      }}
    >
      {iconSymbol}
    </div>
  );
}

/**
 * ResidentDashboard - OOP Class-based Component
 * Main dashboard for residents with map integration
 */
class ResidentDashboard extends React.Component {
  // Class constant - Evacuation centers data
  static EVACUATION_CENTERS = [
    {
      id: 1,
      name: "Sta. Maria Covered Court",
      address: "789 Poblacion St., Sta. Maria, Bulacan",
      position: [120.963, 14.821],
      capacity: "0 / 0 Capacity",
      percent: 0,
      tag: "Wheelchair Accessible",
      tagIcon: faWheelchair,
      blood: "B+",
      isFull: false,
    },
    {
      id: 2,
      name: "Cabayao Elementary School",
      address: "Cabayao St., Sta. Maria, Bulacan",
      position: [120.958, 14.815],
      capacity: "0 / 0 Capacity",
      percent: 0,
      tag: "PWD-Friendly",
      tagIcon: faUserGroup,
      blood: "B+",
      isFull: false,
    },
  ];

  constructor(props) {
    super(props);

    this.state = {
      userName: "Resident",
      accountType: "",
      userPhotoUrl: "",
      showProfileMenu: false,
      activeTab: "dashboard",
      searchQuery: "",
      mapCenter: ORIGINAL_CENTER,
      userCurrentLocation: null,
      locationAccuracyMeters: null,
      currentTime: new Date(),
      lastUpdatedAt: new Date(),
      sosTriggeredAt: null,
      selectedSosDisasterType: "",
      isSharingLocation: false,
      locationShareStartedAt: null,
      locationShareEndsAt: null,
      sharedLocationCoordinates: null,
      shareDurationMinutes: 15,
      evacuationCenters: ResidentDashboard.EVACUATION_CENTERS.map((center) => ({
        ...center,
      })),
      evacuationArrival: null,
      confirmingArrivalCenterId: null,
      clearingArrival: false,
      accessibilitySettings: {
        screenReader: false,
        highContrast: false,
        largeText: false,
      },
      emergencyEvents: [],
      notifications: [
        {
          id: "lgu-1",
          type: "announcement",
          title: "LGU Announcement",
          description:
            "City hall confirms relief goods distribution at 4:00 PM.",
        },
        {
          id: "evac-1",
          type: "update",
          title: "Evacuation Update",
          description:
            "Sta. Maria Covered Court remains available for incoming residents.",
        },
      ],
      notificationWidgetCollapsed: true,
      disasterAlertDismissedId: null,
      // profileQrCode removed
    };

    // Bind methods
    this.geolocateControlRef = React.createRef();
    this.handleSearch = this.handleSearch.bind(this);
    this.handleProfileMenuClick = this.handleProfileMenuClick.bind(this);
    this.handleReturnToOrigin = this.handleReturnToOrigin.bind(this);
    this.handleLocateUser = this.handleLocateUser.bind(this);
    this.handleMapLocationFound = this.handleMapLocationFound.bind(this);
    this.handleMapLocationError = this.handleMapLocationError.bind(this);
    this.handleEvacCardClick = this.handleEvacCardClick.bind(this);
    this.fetchUserData = this.fetchUserData.bind(this);
    this.startUserProfileListener = this.startUserProfileListener.bind(this);
    this.getLastUpdatedLabel = this.getLastUpdatedLabel.bind(this);
    this.getSosTimestampLabel = this.getSosTimestampLabel.bind(this);
    this.getLocationShareDurationLabel =
      this.getLocationShareDurationLabel.bind(this);
    this.startEmergencyFeedListener =
      this.startEmergencyFeedListener.bind(this);
    this.startEvacuationCapacityListener =
      this.startEvacuationCapacityListener.bind(this);
    this.getEventTimeLabel = this.getEventTimeLabel.bind(this);
    this.getNotificationItems = this.getNotificationItems.bind(this);
    this.toggleNotificationWidgetCollapsed =
      this.toggleNotificationWidgetCollapsed.bind(this);
    this.getActiveSosEventForCurrentUser =
      this.getActiveSosEventForCurrentUser.bind(this);
    this.hasActiveSosForCurrentUser =
      this.hasActiveSosForCurrentUser.bind(this);
    this.handleTriggerSOS = this.handleTriggerSOS.bind(this);
    this.handleTriggerSosAndShare = this.handleTriggerSosAndShare.bind(this);
    this.setSosDisasterType = this.setSosDisasterType.bind(this);
    this.handleSosDisasterTypeChange =
      this.handleSosDisasterTypeChange.bind(this);
    this.confirmLowAccuracyProceed = this.confirmLowAccuracyProceed.bind(this);
    this.resolveLocationLabelFromCoordinates =
      this.resolveLocationLabelFromCoordinates.bind(this);
    this.resolveCurrentLocationForSos =
      this.resolveCurrentLocationForSos.bind(this);
    this.handleShareLocation = this.handleShareLocation.bind(this);
    this.handleStopLocationShare = this.handleStopLocationShare.bind(this);
    this.getDirectionsUrl = this.getDirectionsUrl.bind(this);
    this.getCenterCapacitySnapshot = this.getCenterCapacitySnapshot.bind(this);
    this.getCapacityDocRefForCenter =
      this.getCapacityDocRefForCenter.bind(this);
    this.getEvacuationPartySizeFromUserData =
      this.getEvacuationPartySizeFromUserData.bind(this);
    this.getArrivalStatusLabel = this.getArrivalStatusLabel.bind(this);
    this.handleConfirmArrival = this.handleConfirmArrival.bind(this);
    this.handleClearArrival = this.handleClearArrival.bind(this);
    this.isArrivalConfirmedForCenter =
      this.isArrivalConfirmedForCenter.bind(this);
    this.handleTabChange = this.handleTabChange.bind(this);
    this.renderActiveTabPage = this.renderActiveTabPage.bind(this);
  }

  /**
   * Component lifecycle - fetch user data on mount
   */
  componentDidMount() {
    if (this.props.initialTab) {
      this.handleTabChange(this.props.initialTab);
    }

    this.fetchUserData();
    this.startUserProfileListener();
    this.startEmergencyFeedListener();
    this.startEvacuationCapacityListener();

    // Voice assistant: listen for tab-change events dispatched by VoiceAssistant
    this._handleVoiceTabChange = (event) => {
      const tab = event?.detail?.tab;
      if (tab) this.handleTabChange(tab);
    };
    window.addEventListener("voiceTabChange", this._handleVoiceTabChange);

    this._handleVoiceSosDisasterTypeChange = (event) => {
      const disasterType = String(event?.detail?.disasterType || "")
        .trim()
        .toLowerCase();
      if (!disasterType) return;
      this.setSosDisasterType(disasterType);
    };
    window.addEventListener(
      "voiceSosDisasterTypeChange",
      this._handleVoiceSosDisasterTypeChange,
    );

    this._handleVoiceTriggerSos = async (event) => {
      const shouldShareLocation = Boolean(event?.detail?.shareLocation);
      if (shouldShareLocation) {
        await this.handleTriggerSosAndShare();
        return;
      }

      await this.handleTriggerSOS();
    };
    window.addEventListener("voiceTriggerSos", this._handleVoiceTriggerSos);
    this.lastUpdatedTimer = setInterval(() => {
      const now = new Date();
      this.setState((prevState) => {
        if (
          prevState.isSharingLocation &&
          prevState.locationShareEndsAt &&
          now >= prevState.locationShareEndsAt
        ) {
          const currentUser = auth.currentUser;
          if (currentUser) {
            const sharedLat = Number(prevState.sharedLocationCoordinates?.lat);
            const sharedLng = Number(prevState.sharedLocationCoordinates?.lng);
            const [mapLng, mapLat] = prevState.mapCenter;
            const lat = Number.isFinite(sharedLat) ? sharedLat : mapLat;
            const lng = Number.isFinite(sharedLng) ? sharedLng : mapLng;
            EmergencyEventService.createLocationShareStoppedEvent({
              userId: currentUser.uid,
              userName: prevState.userName,
              reason: "expired",
              startedAt: prevState.locationShareStartedAt,
              endedAt: now,
              durationMinutes: prevState.shareDurationMinutes,
              coordinates: { lat, lng },
            }).catch((error) => {
              console.error("Failed to persist share expiration event:", error);
            });
          }

          return {
            currentTime: now,
            isSharingLocation: false,
            locationShareStartedAt: null,
            locationShareEndsAt: null,
            sharedLocationCoordinates: null,
            lastUpdatedAt: now,
          };
        }

        return { currentTime: now };
      });
    }, 30000);
  }

  componentWillUnmount() {
    if (this.lastUpdatedTimer) {
      clearInterval(this.lastUpdatedTimer);
    }
    if (this._handleVoiceTabChange) {
      window.removeEventListener("voiceTabChange", this._handleVoiceTabChange);
    }
    if (this._handleVoiceSosDisasterTypeChange) {
      window.removeEventListener(
        "voiceSosDisasterTypeChange",
        this._handleVoiceSosDisasterTypeChange,
      );
    }
    if (this._handleVoiceTriggerSos) {
      window.removeEventListener(
        "voiceTriggerSos",
        this._handleVoiceTriggerSos,
      );
    }
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }
    if (this.userProfileUnsubscribe) {
      this.userProfileUnsubscribe();
    }
    if (this.capacityUnsubscribe) {
      this.capacityUnsubscribe();
    }
  }

  startUserProfileListener() {
    const user = auth.currentUser;
    if (!user) return;

    if (this.userProfileUnsubscribe) {
      this.userProfileUnsubscribe();
    }

    const userRef = doc(db, "users", user.uid);
    this.userProfileUnsubscribe = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const userData = snapshot.data();

      this.setState({
        userName: userData.fullName || "Resident",
        accountType: userData.accountType || userData.userType || "",
        userPhotoUrl: userData.photoUrl || "",
        evacuationArrival: userData.evacuationArrival || null,
        accessibilitySettings: normalizeAccessibilitySettings(
          userData?.accessibilitySettings,
        ),
      });
    });
  }

  startEvacuationCapacityListener() {
    if (this.capacityUnsubscribe) {
      this.capacityUnsubscribe();
    }

    const capacityRef = collection(db, "evacuationCenterCapacity");

    this.capacityUnsubscribe = onSnapshot(
      capacityRef,
      (snapshot) => {
        const updatesByCenterId = new Map();
        const updatesByCenterName = new Map();

        snapshot.forEach((centerDoc) => {
          const data = centerDoc.data() || {};
          const rawCenterId = data.centerId ?? centerDoc.id;
          const numericCenterId = Number(rawCenterId);
          const centerId = Number.isFinite(numericCenterId)
            ? numericCenterId
            : String(rawCenterId);

          updatesByCenterId.set(String(centerId), {
            centerId,
            name: data.centerName || data.name || "",
            address: data.address,
            capacity: Number(data.capacity),
            headcount: Number(data.headcount),
          });

          const nameKey = normalizeCenterKey(data.centerName || data.name);
          if (nameKey) {
            updatesByCenterName.set(
              nameKey,
              updatesByCenterId.get(String(centerId)),
            );
          }
        });

        this.setState((prevState) => {
          const centerTemplates = [
            ...ResidentDashboard.EVACUATION_CENTERS,
            ...prevState.evacuationCenters,
          ];
          const centersFromFirebase = [];

          updatesByCenterId.forEach((update) => {
            const template =
              centerTemplates.find(
                (center) => String(center.id) === String(update.centerId),
              ) ||
              centerTemplates.find(
                (center) =>
                  normalizeCenterKey(center.name) ===
                  normalizeCenterKey(update.name),
              );

            const fallback = parseCenterCapacityText(template?.capacity);
            const nextCapacity =
              Number.isFinite(update.capacity) && update.capacity > 0
                ? Math.floor(update.capacity)
                : fallback.capacity;
            const rawHeadcount =
              Number.isFinite(update.headcount) && update.headcount >= 0
                ? Math.floor(update.headcount)
                : fallback.headcount;
            const boundedHeadcount = Math.max(
              0,
              Math.min(rawHeadcount, Math.max(0, nextCapacity)),
            );
            const percent =
              nextCapacity > 0
                ? Math.round((boundedHeadcount / nextCapacity) * 100)
                : 0;

            centersFromFirebase.push({
              id: update.centerId,
              name: update.name || template?.name || "Evacuation Center",
              address:
                update.address || template?.address || "Unknown location",
              position: Array.isArray(template?.position)
                ? [...template.position]
                : [...ORIGINAL_CENTER],
              capacity: `${boundedHeadcount} / ${nextCapacity} Capacity`,
              percent,
              tag: template?.tag || "PWD-Friendly",
              tagIcon: template?.tagIcon || faUserGroup,
              blood: template?.blood || "N/A",
              isFull: nextCapacity > 0 && boundedHeadcount >= nextCapacity,
            });
          });

          return {
            evacuationCenters: centersFromFirebase,
          };
        });
      },
      (error) => {
        console.error(
          "[ResidentDashboard] Failed to auto-load center capacity:",
          error,
        );
      },
    );
  }

  startEmergencyFeedListener() {
    if (this.emergencyFeedUnsubscribe) {
      this.emergencyFeedUnsubscribe();
    }

    this.emergencyFeedUnsubscribe =
      EmergencyEventService.subscribeToRecentEvents((events) => {
        this.setState({ emergencyEvents: events });
      }, 8);
  }

  getEventTimeLabel(event) {
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

  // fetchProfileQrCode removed

  /**
   * Fetch user profile data from Firestore
   * @private
   */
  async fetchUserData() {
    const user = auth.currentUser;
    if (user) {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          this.setState({
            userName: userData.fullName || "Resident",
            accountType: userData.accountType || userData.userType || "",
            userPhotoUrl: userData.photoUrl || "",
            evacuationArrival: userData.evacuationArrival || null,
            accessibilitySettings: normalizeAccessibilitySettings(
              userData?.accessibilitySettings,
            ),
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    }
  }

  /**
   * Handle location search with geocoding
   * @private
   */
  async handleSearch(e) {
    if (e.key === "Enter" && this.state.searchQuery.trim() !== "") {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            this.state.searchQuery,
          )}`,
        );
        const data = await response.json();
        if (data.length > 0) {
          const { lat, lon } = data[0];
          this.setState({ mapCenter: [parseFloat(lat), parseFloat(lon)] });
        } else {
          alert("Location not found.");
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }
  }

  /**
   * Handle profile menu visibility
   * @private
   */
  handleProfileMenuClick() {
    this.setState((prevState) => ({
      showProfileMenu: !prevState.showProfileMenu,
    }));
  }

  /**
   * Return map to original location
   * @private
   */
  handleReturnToOrigin() {
    this.setState({
      mapCenter: [...ORIGINAL_CENTER],
      searchQuery: "",
    });
  }

  handleLocateUser() {
    if (!isSecureGeolocationContext()) {
      this.handleMapLocationError(
        "Location requires a secure origin. Use HTTPS in production (localhost is allowed in development).",
      );
      return;
    }

    if (this.geolocateControlRef.current?.trigger) {
      this.geolocateControlRef.current.trigger();
      return;
    }

    this.resolveCurrentLocationForSos()
      .then(({ coordinates }) => {
        const lat = Number(coordinates?.lat);
        const lng = Number(coordinates?.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          this.handleMapLocationError();
          return;
        }

        this.handleMapLocationFound({ lat, lng, accuracy: null });
      })
      .catch(() => {
        this.handleMapLocationError();
      });
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
        mapCenter: [lng, lat],
        userCurrentLocation: [lng, lat],
        locationAccuracyMeters: Number.isFinite(accuracy)
          ? Math.round(accuracy)
          : null,
        lastUpdatedAt: new Date(),
      };
    });
  }

  handleMapLocationError(message) {
    alert(
      message ||
        "Unable to determine your current location. Check browser location permission, ensure precise/fine location is enabled, and try outdoors—indoor Wi-Fi/cellular triangulation is often less accurate than satellite GPS.",
    );
  }

  /**
   * Handle evacuation card click to center map
   * @private
   */
  handleEvacCardClick(position) {
    this.setState({ mapCenter: position });
  }

  handleTabChange(tabKey) {
    this.setState({ activeTab: tabKey });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderActiveTabPage() {
    const { activeTab } = this.state;

    switch (activeTab) {
      case "alerts":
        return <ResidentAlerts />;
      case "evac-plan":
        return <ResidentEvacPlan />;
      case "resources":
        return <ResidentResources />;
      case "contacts":
        return <ResidentContacts />;
      case "sectors":
        return <ResidentSectors />;
      case "dashboard":
      default:
        return null;
    }
  }

  getLastUpdatedLabel() {
    const { lastUpdatedAt, currentTime } = this.state;
    if (!lastUpdatedAt) return "just now";

    const elapsedMinutes = Math.max(
      0,
      Math.floor((currentTime.getTime() - lastUpdatedAt.getTime()) / 60000),
    );

    if (elapsedMinutes === 0) return "just now";
    if (elapsedMinutes === 1) return "1 minute ago";
    return `${elapsedMinutes} minutes ago`;
  }

  getSosTimestampLabel() {
    const { sosTriggeredAt } = this.state;
    if (!sosTriggeredAt) return "Not triggered";

    return sosTriggeredAt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  getLocationShareDurationLabel() {
    const {
      isSharingLocation,
      locationShareStartedAt,
      locationShareEndsAt,
      shareDurationMinutes,
      currentTime,
    } = this.state;

    if (!isSharingLocation || !locationShareStartedAt || !locationShareEndsAt) {
      return `Inactive • ${shareDurationMinutes}-minute temporary window`;
    }

    const totalWindow = Math.max(
      0,
      Math.ceil(
        (locationShareEndsAt.getTime() - locationShareStartedAt.getTime()) /
          60000,
      ),
    );
    const remaining = Math.max(
      0,
      Math.ceil(
        (locationShareEndsAt.getTime() - currentTime.getTime()) / 60000,
      ),
    );

    return `${totalWindow} min temporary share • ${remaining} min left`;
  }

  toggleNotificationWidgetCollapsed() {
    this.setState((prev) => ({
      notificationWidgetCollapsed: !prev.notificationWidgetCollapsed,
    }));
  }

  getNotificationItems() {
    const {
      notifications,
      emergencyEvents,
      sosTriggeredAt,
      selectedSosDisasterType,
      isSharingLocation,
      locationShareEndsAt,
      currentTime,
    } = this.state;

    const dynamicItems = [];

    if (sosTriggeredAt) {
      const activeSosDisasterType = getDisasterTypeLabel(
        selectedSosDisasterType,
      );
      dynamicItems.push({
        id: "sos-live",
        type: "sos",
        title: "SOS Alert",
        description: `Triggered at ${this.getSosTimestampLabel()} for ${activeSosDisasterType}.`,
      });
    }

    if (isSharingLocation && locationShareEndsAt) {
      const remaining = Math.max(
        0,
        Math.ceil(
          (locationShareEndsAt.getTime() - currentTime.getTime()) / 60000,
        ),
      );
      dynamicItems.push({
        id: "share-live",
        type: "update",
        title: "Location Sharing",
        description: `Temporary location share is active (${remaining} min left).`,
      });
    }

    const feedItems = emergencyEvents.map((event) => {
      if (event.type === "announcement") {
        const announcementDisasterType =
          event.disasterTypeLabel ||
          (event.disasterType ? getDisasterTypeLabel(event.disasterType) : "");
        return {
          id: `feed-${event.id}`,
          type: "announcement",
          title: "LGU Announcement",
          description: event.message || "Official local government update.",
          disasterTypeLabel: announcementDisasterType,
          meta: this.getEventTimeLabel(event),
        };
      }

      if (event.type === "sos") {
        const eventDisasterType =
          event.disasterTypeLabel || getDisasterTypeLabel(event.disasterType);
        return {
          id: `feed-${event.id}`,
          type: "sos",
          title: "SOS Alert",
          description: `${event.userName || "Resident"} triggered ${eventDisasterType} SOS at ${event.locationLabel || "Pinned location"}.`,
          meta: this.getEventTimeLabel(event),
        };
      }

      if (event.type === "evacuation-arrival") {
        const isDeparted =
          event.status === "departed" || event.status === "cleared";
        return {
          id: `feed-${event.id}`,
          type: "update",
          title: isDeparted ? "Departure Confirmed" : "Arrival Confirmed",
          description: isDeparted
            ? `${event.userName || "Resident"} confirmed departure from ${event.centerName || "the evacuation center"}.`
            : `${event.userName || "Resident"} confirmed arrival at ${event.centerName || "an evacuation center"}.`,
          meta: this.getEventTimeLabel(event),
        };
      }

      return {
        id: `feed-${event.id}`,
        type: "update",
        title:
          event.status === "stopped"
            ? "Location Sharing Ended"
            : "Evacuation Update",
        description:
          event.status === "stopped"
            ? `${event.userName || "Resident"} stopped location sharing.`
            : `${event.userName || "Resident"} shared location temporarily.`,
        meta: this.getEventTimeLabel(event),
      };
    });

    const merged = [...dynamicItems, ...feedItems, ...notifications];
    const unique = [];
    const seen = new Set();
    merged.forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    });

    return unique.slice(0, 8);
  }

  getActiveSosEventForCurrentUser() {
    const { emergencyEvents } = this.state;
    const currentUserId = auth.currentUser?.uid;

    if (!currentUserId) {
      return null;
    }

    const resolvedSourceEventIds = new Set(
      emergencyEvents
        .filter((event) => event.type === "resolution" && event.sourceEventId)
        .map((event) => event.sourceEventId),
    );

    return (
      emergencyEvents.find(
        (event) =>
          event.type === "sos" &&
          event.userId === currentUserId &&
          event.status !== "resolved" &&
          event.status !== "stopped" &&
          !resolvedSourceEventIds.has(event.id),
      ) || null
    );
  }

  hasActiveSosForCurrentUser() {
    return Boolean(this.getActiveSosEventForCurrentUser());
  }

  confirmLowAccuracyProceed(accuracyMeters, mode = "sos") {
    const accuracyValue = Number(accuracyMeters);

    if (
      !Number.isFinite(accuracyValue) ||
      accuracyValue <= LOW_ACCURACY_THRESHOLD_METERS
    ) {
      return true;
    }

    const roundedAccuracy = Math.round(accuracyValue);
    const actionLabel =
      mode === "share" ? "share your location" : "trigger SOS";

    return window.confirm(
      `GPS accuracy is currently around ${roundedAccuracy}m (target: ≤${LOW_ACCURACY_THRESHOLD_METERS}m). Indoors, location may fall back to Wi-Fi/cellular triangulation, which is less accurate than satellite GPS. Move to an open area for better precision, or press OK to ${actionLabel} anyway.`,
    );
  }

  getFallbackCoordinatesForEmergency() {
    const fromUserCurrent = this.state.userCurrentLocation;
    const fromMapCenter = this.state.mapCenter;

    const candidates = [
      Array.isArray(fromUserCurrent) ? fromUserCurrent : null,
      Array.isArray(fromMapCenter) ? fromMapCenter : null,
    ];

    for (const candidate of candidates) {
      const lng = Number(candidate?.[0]);
      const lat = Number(candidate?.[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    return null;
  }

  confirmFallbackLocationProceed(reasonLabel, mode = "sos") {
    const actionLabel =
      mode === "share" ? "share your location" : "trigger SOS";
    const reason = String(reasonLabel || "Precise GPS not available.");

    return window.confirm(
      `${reason}\n\nUse your current map pin / last known location instead and ${actionLabel}?`,
    );
  }

  async handleTriggerSOS() {
    if (this.hasActiveSosForCurrentUser()) {
      return false;
    }

    const now = new Date();
    const currentUser = auth.currentUser;
    const disasterType = String(this.state.selectedSosDisasterType || "")
      .trim()
      .toLowerCase();
    if (!disasterType) {
      alert("Please select a disaster type before triggering SOS.");
      return false;
    }
    const disasterTypeLabel = getDisasterTypeLabel(disasterType);
    const { coordinates, locationLabel, accuracyMeters } =
      await this.resolveCurrentLocationForSos();

    let lat = Number(coordinates?.lat);
    let lng = Number(coordinates?.lng);
    let effectiveLocationLabel = locationLabel;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const fallbackCoordinates = this.getFallbackCoordinatesForEmergency();
      if (!fallbackCoordinates) {
        alert(
          `${locationLabel || "Unable to get your exact GPS location."} Please enable location permission and try again.`,
        );
        return false;
      }

      if (!this.confirmFallbackLocationProceed(locationLabel, "sos")) {
        return false;
      }

      lat = fallbackCoordinates.lat;
      lng = fallbackCoordinates.lng;
      effectiveLocationLabel = "Map-selected / last known location";
    }

    if (!this.confirmLowAccuracyProceed(accuracyMeters, "sos")) {
      return false;
    }

    const coordinateLabel =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        : effectiveLocationLabel;

    this.setState({
      sosTriggeredAt: now,
      mapCenter: [lng, lat],
      userCurrentLocation: [lng, lat],
      locationAccuracyMeters: Number.isFinite(Number(accuracyMeters))
        ? Math.round(Number(accuracyMeters))
        : this.state.locationAccuracyMeters,
      lastUpdatedAt: now,
    });

    if (!currentUser) return false;

    try {
      await EmergencyEventService.createSosEvent({
        userId: currentUser.uid,
        userName: this.state.userName,
        triggeredAt: now,
        disasterType,
        disasterTypeLabel,
        locationLabel: coordinateLabel,
        coordinates: { lat, lng },
      });
      return true;
    } catch (error) {
      console.error("Failed to persist SOS event:", error);
      return false;
    }
  }

  async handleTriggerSosAndShare() {
    if (this.hasActiveSosForCurrentUser()) {
      return;
    }

    const sosTriggered = await this.handleTriggerSOS();

    if (sosTriggered && !this.state.isSharingLocation) {
      await this.handleShareLocation();
    }
  }

  setSosDisasterType(disasterType) {
    const normalizedType = String(disasterType || "")
      .trim()
      .toLowerCase();
    const isValidType = SOS_DISASTER_TYPE_OPTIONS.some(
      (option) => option.value === normalizedType,
    );

    if (!isValidType) {
      return false;
    }

    this.setState({ selectedSosDisasterType: normalizedType });
    return true;
  }

  handleSosDisasterTypeChange(event) {
    this.setSosDisasterType(event?.target?.value);
  }

  resolveCurrentLocationForSos() {
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
          locationLabel: "Location unavailable",
          coordinates: null,
        });
        return;
      }

      let settled = false;
      let watchId = null;
      let settleTimer = null;
      let bestCoords = null;
      let sampleCount = 0;

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
          sampleCount += 1;
          const lat = Number(position.coords.latitude.toFixed(6));
          const lng = Number(position.coords.longitude.toFixed(6));
          const accuracy =
            Number(position.coords.accuracy) || Number.POSITIVE_INFINITY;

          if (!bestCoords || accuracy < bestCoords.accuracy) {
            bestCoords = {
              lat,
              lng,
              accuracy,
            };
          }

          if (accuracy <= 10 && sampleCount >= 2) {
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
        GEOLOCATION_POSITION_OPTIONS,
      );

      settleTimer = setTimeout(() => finalize(), 12000);
    });
  }

  async resolveLocationLabelFromCoordinates(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat,
        )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
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

  async handleShareLocation() {
    const now = new Date();
    const { shareDurationMinutes, userName } = this.state;
    const currentUser = auth.currentUser;
    const endsAt = new Date(now.getTime() + shareDurationMinutes * 60000);
    const { coordinates, locationLabel, accuracyMeters } =
      await this.resolveCurrentLocationForSos();

    let lat = Number(coordinates?.lat);
    let lng = Number(coordinates?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const fallbackCoordinates = this.getFallbackCoordinatesForEmergency();
      if (!fallbackCoordinates) {
        alert(
          `${locationLabel || "Unable to get your exact GPS location for sharing."} Please enable location permission and try again.`,
        );
        return false;
      }

      if (!this.confirmFallbackLocationProceed(locationLabel, "share")) {
        return false;
      }

      lat = fallbackCoordinates.lat;
      lng = fallbackCoordinates.lng;
    }

    if (!this.confirmLowAccuracyProceed(accuracyMeters, "share")) {
      return false;
    }

    this.setState({
      isSharingLocation: true,
      locationShareStartedAt: now,
      locationShareEndsAt: endsAt,
      mapCenter: [lng, lat],
      userCurrentLocation: [lng, lat],
      locationAccuracyMeters: Number.isFinite(Number(accuracyMeters))
        ? Math.round(Number(accuracyMeters))
        : this.state.locationAccuracyMeters,
      sharedLocationCoordinates: { lat, lng },
      lastUpdatedAt: now,
    });

    if (!currentUser) return false;

    try {
      await EmergencyEventService.createLocationShareEvent({
        userId: currentUser.uid,
        userName,
        startedAt: now,
        endsAt,
        durationMinutes: shareDurationMinutes,
        coordinates: { lat, lng },
      });
      return true;
    } catch (error) {
      console.error("Failed to persist location sharing event:", error);
      return false;
    }
  }

  async handleStopLocationShare() {
    const now = new Date();
    const {
      locationShareStartedAt,
      shareDurationMinutes,
      userName,
      mapCenter,
      sharedLocationCoordinates,
    } = this.state;
    const currentUser = auth.currentUser;
    const sharedLat = Number(sharedLocationCoordinates?.lat);
    const sharedLng = Number(sharedLocationCoordinates?.lng);
    const [mapLng, mapLat] = mapCenter;
    const lat = Number.isFinite(sharedLat) ? sharedLat : mapLat;
    const lng = Number.isFinite(sharedLng) ? sharedLng : mapLng;

    this.setState({
      isSharingLocation: false,
      locationShareStartedAt: null,
      locationShareEndsAt: null,
      sharedLocationCoordinates: null,
      lastUpdatedAt: now,
    });

    if (!currentUser) return;

    try {
      await EmergencyEventService.createLocationShareStoppedEvent({
        userId: currentUser.uid,
        userName,
        reason: "manual",
        startedAt: locationShareStartedAt,
        endedAt: now,
        durationMinutes: shareDurationMinutes,
        coordinates: { lat, lng },
      });
    } catch (error) {
      console.error("Failed to persist location stop event:", error);
    }
  }

  getDirectionsUrl(position) {
    if (!Array.isArray(position) || position.length < 2) {
      return "";
    }

    const lng = Number(position[0]);
    const lat = Number(position[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return "";
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}&travelmode=driving`;
  }

  getCenterCapacitySnapshot(data, fallbackCenter = null) {
    const fallback = parseCenterCapacityText(fallbackCenter?.capacity);
    const rawCapacity =
      data?.capacity ?? data?.maxCapacity ?? data?.totalCapacity;
    const directHeadcount =
      data?.headcount ?? data?.current ?? data?.occupied ?? data?.currentCount;
    const rawAvailableSlots =
      data?.availableSlots ?? data?.remainingSlots ?? data?.slotsAvailable;

    const capacity =
      Number.isFinite(Number(rawCapacity)) && Number(rawCapacity) > 0
        ? Math.floor(Number(rawCapacity))
        : fallback.capacity;
    const parsedHeadcount = Number(directHeadcount);
    const parsedAvailableSlots = Number(rawAvailableSlots);
    const fallbackHeadcount = fallback.headcount;
    const derivedHeadcount = Number.isFinite(parsedHeadcount)
      ? Math.floor(parsedHeadcount)
      : Number.isFinite(parsedAvailableSlots) && capacity > 0
        ? Math.max(0, capacity - Math.floor(parsedAvailableSlots))
        : fallbackHeadcount;

    return {
      capacity: Math.max(0, capacity),
      headcount: Math.max(0, Math.min(derivedHeadcount, Math.max(0, capacity))),
    };
  }

  getCapacityDocRefForCenter(centerLike) {
    if (!centerLike) {
      return null;
    }

    const explicitId = centerLike.centerId ?? centerLike.id;
    if (
      explicitId !== undefined &&
      explicitId !== null &&
      String(explicitId).trim()
    ) {
      return doc(db, "evacuationCenterCapacity", String(explicitId));
    }

    const matchedCenter = this.state.evacuationCenters.find(
      (center) =>
        normalizeCenterKey(center.name) ===
        normalizeCenterKey(centerLike.centerName || centerLike.name),
    );

    if (!matchedCenter) {
      return null;
    }

    return doc(db, "evacuationCenterCapacity", String(matchedCenter.id));
  }

  getEvacuationPartySizeFromUserData(userData) {
    const normalizedAccountType = String(
      userData?.accountType ||
        userData?.userType ||
        this.state.accountType ||
        "",
    )
      .trim()
      .toLowerCase();

    if (normalizedAccountType !== "residential-family") {
      return 1;
    }

    const familyProfile = userData?.familyProfile || {};
    const declaredTotalMembers = Number(familyProfile.totalMembers);
    const listedHouseholdMembers = Array.isArray(familyProfile.householdMembers)
      ? familyProfile.householdMembers.filter((member) => {
          return Boolean(
            String(member?.name || "").trim() ||
            String(member?.relationship || "").trim() ||
            String(member?.dateOfBirth || member?.dob || "").trim(),
          );
        }).length
      : 0;
    const legacyDependents = Array.isArray(userData?.dependents)
      ? userData.dependents.length
      : 0;

    const computedPartySize = Math.max(
      Number.isFinite(declaredTotalMembers) && declaredTotalMembers > 0
        ? Math.floor(declaredTotalMembers)
        : 0,
      listedHouseholdMembers > 0 ? listedHouseholdMembers + 1 : 0,
      legacyDependents > 0 ? legacyDependents + 1 : 0,
      1,
    );

    return computedPartySize;
  }

  getArrivalStatusLabel(arrival) {
    const confirmedAt = toDateValue(arrival?.confirmedAt);
    if (!confirmedAt) {
      return "Arrival confirmed";
    }

    return `Arrived ${confirmedAt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  isArrivalConfirmedForCenter(center) {
    const { evacuationArrival } = this.state;
    if (!evacuationArrival?.arrived || !center) {
      return false;
    }

    if (String(evacuationArrival.centerId || "") === String(center.id || "")) {
      return true;
    }

    return (
      normalizeCenterKey(evacuationArrival.centerName) ===
      normalizeCenterKey(center.name)
    );
  }

  async handleConfirmArrival(center) {
    const currentUser = auth.currentUser;
    if (!currentUser || !center) {
      alert("You need to be signed in to confirm evacuation arrival.");
      return;
    }

    this.setState({ confirmingArrivalCenterId: center.id });

    try {
      let confirmedPartySize = 1;
      const userRef = doc(db, "users", currentUser.uid);
      const targetCenterRef = this.getCapacityDocRefForCenter(center);

      if (!targetCenterRef) {
        throw new Error(
          "Selected evacuation center capacity record was not found.",
        );
      }

      await runTransaction(db, async (transaction) => {
        const [userSnap, targetCenterSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(targetCenterRef),
        ]);

        if (!targetCenterSnap.exists()) {
          throw new Error(
            "Selected evacuation center capacity record was not found.",
          );
        }

        const userData = userSnap.exists() ? userSnap.data() : {};
        const previousArrival = userData?.evacuationArrival || null;
        const partySize = this.getEvacuationPartySizeFromUserData(userData);
        confirmedPartySize = partySize;
        const previousArrivalMemberCount = Number(previousArrival?.memberCount);
        const previousPartySize =
          Number.isFinite(previousArrivalMemberCount) &&
          previousArrivalMemberCount > 0
            ? Math.floor(previousArrivalMemberCount)
            : partySize;
        const targetCenterData = targetCenterSnap.data() || {};
        const targetSnapshot = this.getCenterCapacitySnapshot(
          targetCenterData,
          center,
        );
        const isSameCenter =
          previousArrival?.arrived &&
          (String(previousArrival.centerId || "") === String(center.id) ||
            normalizeCenterKey(previousArrival.centerName) ===
              normalizeCenterKey(center.name));

        let nextTargetHeadcount = targetSnapshot.headcount;
        if (isSameCenter) {
          const delta = partySize - previousPartySize;
          if (delta > 0) {
            if (
              targetSnapshot.capacity > 0 &&
              nextTargetHeadcount + delta > targetSnapshot.capacity
            ) {
              throw new Error(
                "Selected evacuation center does not have enough available slots for your family size.",
              );
            }
            nextTargetHeadcount += delta;
          } else if (delta < 0) {
            nextTargetHeadcount = Math.max(0, nextTargetHeadcount + delta);
          }
        } else {
          if (
            targetSnapshot.capacity > 0 &&
            targetSnapshot.headcount + partySize > targetSnapshot.capacity
          ) {
            throw new Error(
              "Selected evacuation center does not have enough available slots for your family size.",
            );
          }
          nextTargetHeadcount = Math.min(
            targetSnapshot.capacity || targetSnapshot.headcount + partySize,
            targetSnapshot.headcount + partySize,
          );
        }

        if (previousArrival?.arrived && !isSameCenter) {
          const previousCenterRef =
            this.getCapacityDocRefForCenter(previousArrival);
          if (previousCenterRef) {
            const previousCenterSnap = await transaction.get(previousCenterRef);
            if (previousCenterSnap.exists()) {
              const previousCenterState = this.getCenterCapacitySnapshot(
                previousCenterSnap.data() || {},
              );
              const decrementedHeadcount = Math.max(
                0,
                previousCenterState.headcount - previousPartySize,
              );
              transaction.set(
                previousCenterRef,
                {
                  headcount: decrementedHeadcount,
                  availableSlots: Math.max(
                    0,
                    previousCenterState.capacity - decrementedHeadcount,
                  ),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
            }
          }
        }

        transaction.set(
          targetCenterRef,
          {
            headcount: nextTargetHeadcount,
            availableSlots: Math.max(
              0,
              targetSnapshot.capacity - nextTargetHeadcount,
            ),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        transaction.set(
          userRef,
          {
            evacuationArrival: {
              arrived: true,
              centerId: center.id,
              centerName: center.name,
              centerAddress: center.address,
              memberCount: partySize,
              source: "resident-dashboard",
              confirmedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await EmergencyEventService.createEvent({
        type: "evacuation-arrival",
        status: "confirmed",
        userId: currentUser.uid,
        userName: this.state.userName,
        centerId: center.id,
        centerName: center.name,
        centerAddress: center.address,
        memberCount: confirmedPartySize,
      });

      this.setState({
        evacuationArrival: {
          arrived: true,
          centerId: center.id,
          centerName: center.name,
          centerAddress: center.address,
          memberCount: confirmedPartySize,
          source: "resident-dashboard",
          confirmedAt: new Date(),
        },
        confirmingArrivalCenterId: null,
      });
    } catch (error) {
      console.error("Failed to confirm evacuation arrival:", error);
      this.setState({ confirmingArrivalCenterId: null });
      alert("Failed to confirm your arrival. Please try again.");
    }
  }

  async handleClearArrival() {
    const currentUser = auth.currentUser;
    const { evacuationArrival } = this.state;
    if (!currentUser || !evacuationArrival?.arrived) {
      return;
    }

    this.setState({ clearingArrival: true });

    try {
      let departureMemberCount =
        Number.isFinite(Number(evacuationArrival.memberCount)) &&
        Number(evacuationArrival.memberCount) > 0
          ? Math.floor(Number(evacuationArrival.memberCount))
          : 1;
      const userRef = doc(db, "users", currentUser.uid);
      const centerRef = this.getCapacityDocRefForCenter(evacuationArrival);

      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const currentArrival = userSnap.exists()
          ? userSnap.data()?.evacuationArrival || null
          : evacuationArrival;

        if (currentArrival?.arrived && centerRef) {
          const centerSnap = await transaction.get(centerRef);
          if (centerSnap.exists()) {
            const currentArrivalMemberCount = Number(
              currentArrival?.memberCount,
            );
            const departureCount =
              Number.isFinite(currentArrivalMemberCount) &&
              currentArrivalMemberCount > 0
                ? Math.floor(currentArrivalMemberCount)
                : this.getEvacuationPartySizeFromUserData(
                    userSnap.data() || {},
                  );
            departureMemberCount = departureCount;
            const centerState = this.getCenterCapacitySnapshot(
              centerSnap.data() || {},
            );
            const decrementedHeadcount = Math.max(
              0,
              centerState.headcount - departureCount,
            );
            transaction.set(
              centerRef,
              {
                headcount: decrementedHeadcount,
                availableSlots: Math.max(
                  0,
                  centerState.capacity - decrementedHeadcount,
                ),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          }
        }

        transaction.set(
          userRef,
          {
            evacuationArrival: {
              arrived: false,
              centerId: null,
              centerName: "",
              centerAddress: "",
              source: "resident-dashboard",
              confirmedAt: null,
              clearedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await EmergencyEventService.createEvent({
        type: "evacuation-arrival",
        status: "departed",
        userId: currentUser.uid,
        userName: this.state.userName,
        centerId: evacuationArrival.centerId || null,
        centerName: evacuationArrival.centerName || "",
        centerAddress: evacuationArrival.centerAddress || "",
        memberCount: departureMemberCount,
      });

      this.setState({ evacuationArrival: null, clearingArrival: false });
    } catch (error) {
      console.error("Failed to clear evacuation arrival:", error);
      this.setState({ clearingArrival: false });
      alert("Failed to clear your arrival confirmation. Please try again.");
    }
  }

  /**
   * Render EvacCard sub-component
   * @private
   */
  renderEvacCard(center) {
    const { confirmingArrivalCenterId, clearingArrival, evacuationArrival } =
      this.state;
    const {
      name,
      address,
      capacity,
      percent,
      tag,
      tagIcon,
      blood,
      isFull,
      position,
    } = center;
    const nearCapacity = percent >= 90;
    const isArrivedHere = this.isArrivalConfirmedForCenter(center);
    const hasArrivalElsewhere =
      evacuationArrival?.arrived &&
      !isArrivedHere &&
      evacuationArrival?.centerName;
    const isConfirmingThisCenter =
      String(confirmingArrivalCenterId) === String(center.id);

    return (
      <div
        key={center.id}
        onClick={() => this.handleEvacCardClick(position)}
        className='bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group active:scale-[0.99]'
      >
        <div className='flex justify-between items-start mb-2'>
          <div className='flex gap-3'>
            <div className='bg-blue-50 border border-blue-100 p-2 rounded-xl h-fit group-hover:bg-blue-100 transition-colors'>
              <FontAwesomeIcon icon={faShieldHeart} className='text-blue-700' />
            </div>
            <div>
              <h4 className='text-xs font-black text-slate-800 uppercase tracking-tight'>
                {name}
              </h4>
              <p className='text-[10px] text-gray-400 font-semibold leading-tight uppercase'>
                {address}
              </p>
            </div>
          </div>
          <div className='text-[10px] font-black text-blue-700 border border-blue-100 px-2 py-1 rounded-full flex items-center gap-1 bg-blue-50/50'>
            <FontAwesomeIcon icon={faAddressBook} /> {blood}
          </div>
        </div>
        <div className='mt-3'>
          <div className='flex justify-between items-center mb-1'>
            <div className='w-full bg-slate-100 h-2 rounded-full mr-2'>
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isFull ? "bg-red-600" : "bg-blue-600"
                }`}
                style={{ width: `${percent}%` }}
              ></div>
            </div>
            <span className='text-[9px] font-black text-slate-400 whitespace-nowrap uppercase'>
              {capacity}
            </span>
          </div>
          {nearCapacity && (
            <span className='inline-flex items-center gap-1 text-[10px] font-black text-red-600 uppercase'>
              <FontAwesomeIcon icon={faTriangleExclamation} /> Near Capacity
            </span>
          )}
        </div>
        <div className='mt-3 flex gap-2'>
          <span className='bg-slate-900 text-white text-[9px] font-black px-3 py-1 rounded-full flex items-center gap-2 uppercase tracking-tighter'>
            <FontAwesomeIcon icon={tagIcon} className='text-blue-300' /> {tag}
          </span>
          <a
            href={this.getDirectionsUrl(position)}
            target='_blank'
            rel='noreferrer'
            onClick={(event) => event.stopPropagation()}
            className='bg-white border border-slate-200 text-slate-700 text-[9px] font-black px-3 py-1 rounded-full flex items-center gap-2 uppercase tracking-tighter hover:border-blue-200 hover:text-blue-700 transition-colors'
          >
            <FontAwesomeIcon icon={faRoute} /> Directions
          </a>
        </div>
        <div className='mt-3 space-y-2'>
          {isArrivedHere ? (
            <div className='inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700'>
              <FontAwesomeIcon icon={faCheckCircle} />
              {this.getArrivalStatusLabel(evacuationArrival)}
            </div>
          ) : null}
          {hasArrivalElsewhere ? (
            <p className='text-[10px] font-bold text-slate-500 uppercase tracking-wide'>
              Current arrival: {evacuationArrival.centerName}
            </p>
          ) : null}
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={(event) => {
                event.stopPropagation();
                this.handleConfirmArrival(center);
              }}
              disabled={isConfirmingThisCenter}
              className='bg-emerald-600 text-white text-[10px] font-black px-3 py-2 rounded-full uppercase tracking-wide hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {isConfirmingThisCenter
                ? "Saving..."
                : isArrivedHere
                  ? "Update Arrival"
                  : hasArrivalElsewhere
                    ? "Switch Arrival"
                    : "Confirm Arrival"}
            </button>
            {evacuationArrival?.arrived ? (
              <button
                type='button'
                onClick={(event) => {
                  event.stopPropagation();
                  this.handleClearArrival();
                }}
                disabled={clearingArrival || !isArrivedHere}
                className='bg-white border border-slate-200 text-slate-700 text-[10px] font-black px-3 py-2 rounded-full uppercase tracking-wide hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed'
              >
                {clearingArrival
                  ? "Saving..."
                  : isArrivedHere
                    ? "Confirm Departure"
                    : "Departure (Arrived Center Only)"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  renderHeaderTabItem(icon, label, tabKey, active = false) {
    return (
      <button
        type='button'
        key={tabKey}
        onClick={() => this.handleTabChange(tabKey)}
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
    const {
      userName,
      userPhotoUrl,
      showProfileMenu,
      activeTab,
      searchQuery,
      mapCenter,
      userCurrentLocation,
      locationAccuracyMeters,
      selectedSosDisasterType,
      isSharingLocation,
      accessibilitySettings,
      evacuationCenters,
      emergencyEvents,
      evacuationArrival,
      confirmingArrivalCenterId,
      clearingArrival,
      notificationWidgetCollapsed,
      disasterAlertDismissedId,
    } = this.state;
    const centers = evacuationCenters;
    const selectedCenter =
      centers.find(
        (center) =>
          center.position[0] === mapCenter[0] &&
          center.position[1] === mapCenter[1],
      ) || centers[0];
    const lastUpdatedLabel = this.getLastUpdatedLabel();
    const sosTimestampLabel = this.getSosTimestampLabel();
    const locationShareDurationLabel = this.getLocationShareDurationLabel();
    const notificationItems = this.getNotificationItems();
    const activeSosEvent = this.getActiveSosEventForCurrentUser();
    const isSosLocked = this.hasActiveSosForCurrentUser();
    const activeSosDisasterType = String(
      activeSosEvent?.disasterType || selectedSosDisasterType || "",
    )
      .trim()
      .toLowerCase();
    const activeSosGuide = activeSosDisasterType
      ? SOS_GUIDE_BY_DISASTER[activeSosDisasterType] ||
        SOS_GUIDE_BY_DISASTER.other
      : null;
    const activeSosDisasterLabel = activeSosEvent?.disasterTypeLabel
      ? activeSosEvent.disasterTypeLabel
      : activeSosDisasterType
        ? getDisasterTypeLabel(activeSosDisasterType)
        : "";
    const activeGovDisasterAnnouncement =
      emergencyEvents.find(
        (ev) =>
          ev.type === "announcement" &&
          ev.announcementType === "disaster" &&
          ev.status !== "resolved",
      ) || null;
    const activeGovDisasterType = String(
      activeGovDisasterAnnouncement?.disasterType || "",
    )
      .trim()
      .toLowerCase();
    const activeGovDisasterGuide = activeGovDisasterType
      ? SOS_GUIDE_BY_DISASTER[activeGovDisasterType] ||
        SOS_GUIDE_BY_DISASTER.other
      : null;
    const activeGovDisasterLabel =
      activeGovDisasterAnnouncement?.disasterTypeLabel
        ? activeGovDisasterAnnouncement.disasterTypeLabel
        : activeGovDisasterType
          ? getDisasterTypeLabel(activeGovDisasterType)
          : "";
    const accessibilityContainer = getAccessibilityContainerProps(
      accessibilitySettings,
    );
    return (
      <div
        className='min-h-screen bg-[#f3f4f6] font-sans text-slate-700'
        style={accessibilityContainer.style}
        aria-live={accessibilityContainer.ariaLive}
      >
        <a
          href='#main-content'
          className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-9999 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-blue-700 focus:font-bold focus:shadow-lg focus:border focus:border-blue-200'
        >
          Skip to main content
        </a>
        <Header
          sticky={true}
          centerContent={
            <>
              {this.renderHeaderTabItem(
                faHouse,
                "Dashboard",
                "dashboard",
                activeTab === "dashboard",
              )}
              {this.renderHeaderTabItem(
                faBell,
                "Alerts",
                "alerts",
                activeTab === "alerts",
              )}
              {this.renderHeaderTabItem(
                faMapLocationDot,
                "Evac Plan",
                "evac-plan",
                activeTab === "evac-plan",
              )}
              {this.renderHeaderTabItem(
                faBookOpen,
                "Resources",
                "resources",
                activeTab === "resources",
              )}
              {this.renderHeaderTabItem(
                faAddressBook,
                "Contacts",
                "contacts",
                activeTab === "contacts",
              )}
              {this.renderHeaderTabItem(
                faUsersViewfinder,
                "Sectors",
                "sectors",
                activeTab === "sectors",
              )}
            </>
          }
          rightContent={
            <div
              className='relative shrink-0'
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type='button'
                className='flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 pr-3 rounded-full transition-colors'
                onClick={this.handleProfileMenuClick}
                aria-label={`Profile menu for ${userName}`}
                aria-haspopup='true'
                aria-expanded={showProfileMenu}
              >
                <div className='w-8 h-8 rounded-full flex items-center justify-center border border-blue-200 overflow-hidden'>
                  {userPhotoUrl ? (
                    <img
                      src={userPhotoUrl}
                      alt={`${userName}'s profile photo`}
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <div className='bg-blue-100 w-full h-full flex items-center justify-center text-blue-700'>
                      <FontAwesomeIcon icon={faUserCircle} size='lg' />
                    </div>
                  )}
                </div>
                <div className='text-left'>
                  <p className='text-[9px] font-bold text-gray-400 uppercase leading-none mb-1'>
                    Authenticated Resident
                  </p>
                  <p className='text-xs font-black text-[#3a4a5b] leading-none'>
                    {userName}
                  </p>
                </div>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`text-[10px] text-gray-400 transition-transform ${
                    showProfileMenu ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showProfileMenu && (
                <>
                  <div className='hidden lg:block absolute right-0 top-full mt-2 z-2000 profile-dropdown-expandable'>
                    <div className='w-56 bg-white border border-gray-200 rounded-md shadow-xl py-1 overflow-hidden'>
                      <button
                        onClick={() => {
                          this.setState({ showProfileMenu: false });
                          if (typeof this.props.onViewProfile === "function") {
                            this.props.onViewProfile();
                          }
                        }}
                        className='w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faUserCircle} /> View Profile
                      </button>
                      <button
                        onClick={() => {
                          this.setState({ showProfileMenu: false });
                          if (typeof this.props.onOpenSetup === "function") {
                            this.props.onOpenSetup(this.state.accountType);
                          }
                        }}
                        className='w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faPenToSquare} /> Setup Profile
                      </button>
                      <button
                        onClick={this.props.onLogout}
                        className='w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
                      </button>
                    </div>
                  </div>

                  <div className='lg:hidden relative mt-2 w-full profile-dropdown-expandable'>
                    <div className='w-full bg-white border border-gray-200 rounded-md shadow-sm py-1 overflow-hidden'>
                      <button
                        onClick={() => {
                          this.setState({ showProfileMenu: false });
                          if (typeof this.props.onViewProfile === "function") {
                            this.props.onViewProfile();
                          }
                        }}
                        className='w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faUserCircle} /> View Profile
                      </button>
                      <button
                        onClick={() => {
                          this.setState({ showProfileMenu: false });
                          if (typeof this.props.onOpenSetup === "function") {
                            this.props.onOpenSetup(this.state.accountType);
                          }
                        }}
                        className='w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faPenToSquare} /> Setup Profile
                      </button>
                      <button
                        onClick={this.props.onLogout}
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

        <div id='main-content' className='px-3 py-4 lg:px-4 lg:py-5'>
          <div className='w-full space-y-6'>
            {(() => {
              const activeDisasterAnnouncements = emergencyEvents.filter(
                (event) =>
                  event.type === "announcement" &&
                  event.announcementType === "disaster" &&
                  event.status !== "resolved",
              );
              if (activeDisasterAnnouncements.length === 0) return null;
              const latest = activeDisasterAnnouncements[0];
              if (disasterAlertDismissedId === latest.id) return null;
              const disasterLabel =
                latest.disasterTypeLabel ||
                (latest.disasterType
                  ? String(latest.disasterType).charAt(0).toUpperCase() +
                    String(latest.disasterType).slice(1)
                  : "Disaster");
              return (
                <div
                  className='fixed inset-0 z-[9999] flex items-center justify-center'
                  style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                >
                  <div className='relative bg-white rounded-2xl shadow-2xl border-2 border-red-500 w-full max-w-md mx-4 px-7 py-7'>
                    <button
                      onClick={() =>
                        this.setState({ disasterAlertDismissedId: latest.id })
                      }
                      className='absolute top-3 right-4 text-gray-400 hover:text-gray-700 text-xl font-bold leading-none'
                      aria-label='Dismiss'
                    >
                      &times;
                    </button>
                    <div className='flex items-center gap-3 mb-4'>
                      <div className='w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0'>
                        <FontAwesomeIcon
                          icon={faTriangleExclamation}
                          className='text-red-600 text-2xl animate-pulse'
                        />
                      </div>
                      <div>
                        <span className='bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide'>
                          Disaster Alert
                        </span>
                        <p className='text-[11px] font-black text-red-700 uppercase mt-1'>
                          {disasterLabel}
                        </p>
                      </div>
                    </div>
                    <p className='text-base font-black text-red-800 uppercase tracking-tight mb-2'>
                      {latest.alertTitle || "Official Disaster Announcement"}
                    </p>
                    <p className='text-sm font-medium text-slate-700 leading-relaxed'>
                      {latest.message ||
                        "An official disaster announcement has been issued by your LGU. Please follow evacuation instructions."}
                    </p>
                    <p className='text-[11px] font-bold text-red-500 uppercase mt-3'>
                      Issued by: {latest.userName || "LGU"}
                    </p>
                    <button
                      onClick={() =>
                        this.setState({ disasterAlertDismissedId: latest.id })
                      }
                      className='mt-5 w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-black uppercase hover:bg-red-700 transition-colors'
                    >
                      Acknowledge &amp; Close
                    </button>
                  </div>
                </div>
              );
            })()}
            {activeTab !== "dashboard" ? (
              this.renderActiveTabPage()
            ) : (
              <>
                <section className='bg-white border border-gray-200 rounded-lg p-5 shadow-sm scroll-mt-44'>
                  <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
                    <div>
                      <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
                        Resident Command View
                      </p>
                      <h1 className='text-2xl md:text-3xl font-black text-slate-800 mt-1'>
                        Welcome back, {userName.split(" ")[0] || "Resident"}
                      </h1>
                      <p className='text-sm text-slate-600 mt-1 font-medium'>
                        Monitor center capacity and access evacuation plans in
                        one view.
                      </p>
                    </div>
                    <div className='grid w-full md:w-auto'>
                      <div className='bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 min-w-28'>
                        <p className='text-[10px] uppercase font-bold text-blue-500'>
                          Centers
                        </p>
                        <p className='text-xl font-black text-blue-700'>
                          {centers.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <main className='grid grid-cols-1 lg:grid-cols-12 gap-5'>
                  {/* MAIN MAP SECTION */}
                  <section className='lg:col-span-8 scroll-mt-44'>
                    <div className='bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm'>
                      <div className='px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between'>
                        <h2 className='text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-tight'>
                          <FontAwesomeIcon
                            icon={faHouse}
                            className='text-blue-700'
                          />{" "}
                          Resident Dashboard
                        </h2>
                      </div>

                      <div className='p-5'>
                        <h3 className='text-xl font-black text-slate-800'>
                          Evacuation Plan for Sta. Maria, Bulacan
                        </h3>
                        <p className='text-sm text-slate-600 mt-1 font-medium'>
                          Live map view with center status, search, and quick
                          emergency guidance.
                        </p>
                        {activeSosGuide && activeSosEvent ? (
                          <div className='mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm'>
                            <div className='flex items-center gap-2'>
                              <div className='bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide'>
                                Active SOS
                              </div>
                              <p className='text-[11px] font-black text-red-700 uppercase'>
                                {activeSosDisasterLabel}
                              </p>
                            </div>
                            <h4 className='mt-3 text-sm font-black text-slate-800 uppercase tracking-wide'>
                              {activeSosGuide.title}
                            </h4>
                            <div className='mt-2 space-y-2'>
                              {activeSosGuide.steps.map((step, index) => (
                                <div
                                  key={`${activeSosDisasterType}-guide-${index}`}
                                  className='flex gap-2'
                                >
                                  <div className='mt-0.5 h-5 w-5 rounded-full bg-white border border-red-200 text-red-600 text-[10px] font-black flex items-center justify-center shrink-0'>
                                    {index + 1}
                                  </div>
                                  <p className='text-xs font-medium text-slate-700 leading-relaxed'>
                                    {step}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {activeGovDisasterGuide ? (
                          <div className='mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 shadow-sm'>
                            <div className='flex items-center gap-2'>
                              <div className='bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide'>
                                LGU Disaster Alert
                              </div>
                              <p className='text-[11px] font-black text-orange-700 uppercase'>
                                {activeGovDisasterLabel}
                              </p>
                            </div>
                            <h4 className='mt-3 text-sm font-black text-slate-800 uppercase tracking-wide'>
                              {activeGovDisasterGuide.title}
                            </h4>
                            <div className='mt-2 space-y-2'>
                              {activeGovDisasterGuide.steps.map(
                                (step, index) => (
                                  <div
                                    key={`gov-${activeGovDisasterType}-guide-${index}`}
                                    className='flex gap-2'
                                  >
                                    <div className='mt-0.5 h-5 w-5 rounded-full bg-white border border-orange-200 text-orange-600 text-[10px] font-black flex items-center justify-center shrink-0'>
                                      {index + 1}
                                    </div>
                                    <p className='text-xs font-medium text-slate-700 leading-relaxed'>
                                      {step}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}
                        {evacuationArrival?.arrived ? (
                          <div className='mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm'>
                            <div className='flex items-center gap-2'>
                              <div className='bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide'>
                                Arrival Confirmed
                              </div>
                              <p className='text-[11px] font-black text-emerald-700 uppercase'>
                                {evacuationArrival.centerName ||
                                  "Evacuation Center"}
                              </p>
                            </div>
                            <p className='mt-2 text-xs font-medium text-slate-700'>
                              {this.getArrivalStatusLabel(evacuationArrival)}
                            </p>
                            {evacuationArrival.centerAddress ? (
                              <p className='mt-1 text-[11px] font-semibold text-slate-500 uppercase'>
                                {evacuationArrival.centerAddress}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <p className='text-xs font-semibold text-slate-600 mt-2 inline-flex items-center gap-1'>
                          <FontAwesomeIcon
                            icon={faClock}
                            className='text-slate-500'
                          />
                          Last updated: {lastUpdatedLabel}
                        </p>

                        <div className='relative h-[34rem] sm:h-[38rem] lg:h-[44rem] w-full border border-slate-200 rounded-lg overflow-hidden z-0 mt-4'>
                          {(() => {
                            const activeDis = emergencyEvents.filter(
                              (ev) =>
                                ev.type === "announcement" &&
                                ev.announcementType === "disaster" &&
                                ev.status !== "resolved",
                            );
                            if (activeDis.length === 0) return null;
                            const latest = activeDis[0];
                            if (disasterAlertDismissedId !== latest.id)
                              return null;
                            const disLabel =
                              latest.disasterTypeLabel ||
                              (latest.disasterType
                                ? String(latest.disasterType)
                                    .charAt(0)
                                    .toUpperCase() +
                                  String(latest.disasterType).slice(1)
                                : "Disaster");
                            return (
                              <div
                                className='absolute top-3 right-3 z-10 bg-white border-2 border-red-500 rounded-xl shadow-lg px-3 py-2.5 max-w-[220px] cursor-pointer hover:bg-red-50 transition-colors'
                                onClick={() =>
                                  this.setState({
                                    disasterAlertDismissedId: null,
                                  })
                                }
                                title='Click to view disaster alert'
                              >
                                <div className='flex items-center gap-2 mb-1'>
                                  <FontAwesomeIcon
                                    icon={faTriangleExclamation}
                                    className='text-red-600 text-sm animate-pulse flex-shrink-0'
                                  />
                                  <span className='text-[10px] font-black text-red-600 uppercase tracking-wide'>
                                    Disaster Alert
                                  </span>
                                </div>
                                <p className='text-[11px] font-black text-slate-800 uppercase leading-tight'>
                                  {latest.alertTitle || "Official Announcement"}
                                </p>
                                <p className='text-[10px] font-semibold text-red-500 uppercase mt-0.5'>
                                  {disLabel}
                                </p>
                              </div>
                            );
                          })()}
                          <MapView
                            mapLib={maplibregl}
                            mapStyle={MAP_STYLE}
                            longitude={mapCenter[0]}
                            latitude={mapCenter[1]}
                            zoom={14}
                            onMove={(event) => {
                              const { latitude, longitude } = event.viewState;
                              this.setState({
                                mapCenter: [longitude, latitude],
                              });
                            }}
                            style={{ height: "100%", width: "100%" }}
                          >
                            <NavigationControl position='bottom-right' />
                            <GeolocateControl
                              ref={this.geolocateControlRef}
                              position='bottom-right'
                              positionOptions={GEOLOCATION_POSITION_OPTIONS}
                              trackUserLocation
                              showUserHeading
                              onGeolocate={(position) => {
                                const lat = Number(position?.coords?.latitude);
                                const lng = Number(position?.coords?.longitude);
                                const accuracy = Number(
                                  position?.coords?.accuracy,
                                );

                                this.handleMapLocationFound({
                                  lat,
                                  lng,
                                  accuracy,
                                });
                              }}
                            />
                            {userCurrentLocation && (
                              <Marker
                                longitude={userCurrentLocation[0]}
                                latitude={userCurrentLocation[1]}
                                anchor='center'
                              >
                                <div className='w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow' />
                              </Marker>
                            )}
                            {userCurrentLocation &&
                              Number.isFinite(locationAccuracyMeters) && (
                                <Source
                                  id='resident-user-accuracy'
                                  type='geojson'
                                  data={{
                                    type: "FeatureCollection",
                                    features: [
                                      {
                                        type: "Feature",
                                        properties: {
                                          accuracy: locationAccuracyMeters,
                                        },
                                        geometry: {
                                          type: "Point",
                                          coordinates: [
                                            Number(userCurrentLocation[0]),
                                            Number(userCurrentLocation[1]),
                                          ],
                                        },
                                      },
                                    ],
                                  }}
                                >
                                  <Layer {...ACCURACY_LAYER_STYLE} />
                                </Source>
                              )}
                            {centers.map((center) => {
                              const lngLat = toLngLat(center.position);
                              if (!lngLat) return null;
                              return (
                                <Marker
                                  key={center.id}
                                  longitude={lngLat[0]}
                                  latitude={lngLat[1]}
                                  anchor='bottom'
                                  onClick={() =>
                                    this.handleEvacCardClick(center.position)
                                  }
                                >
                                  <div className='flex flex-col items-center gap-1'>
                                    <div className='map-pin-label map-pin-label--full'>
                                      {center.name}
                                    </div>
                                    {renderCenterPin(center.isFull, false)}
                                  </div>
                                </Marker>
                              );
                            })}
                          </MapView>

                          {/* SEARCH & RETURN CONTROLS */}
                          <div className='absolute top-4 left-4 right-4 z-501 flex items-center gap-2 px-1'>
                            <div className='relative flex-1 max-w-md'>
                              <FontAwesomeIcon
                                icon={faMagnifyingGlass}
                                className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs'
                              />
                              <input
                                type='text'
                                placeholder='Search within map...'
                                aria-label='Search evacuation centers'
                                className='w-full pl-9 pr-10 py-2 bg-white/95 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 backdrop-blur-sm'
                                value={searchQuery}
                                onChange={(e) =>
                                  this.setState({ searchQuery: e.target.value })
                                }
                                onKeyDown={this.handleSearch}
                              />
                            </div>

                            {/* HIGH-ACCURACY LOCATE BUTTON */}
                            <button
                              onClick={this.handleLocateUser}
                              title='Locate my current position'
                              aria-label='Locate my current position'
                              className='bg-white/95 border border-slate-200 p-2 rounded-xl text-blue-700 hover:bg-blue-50 transition-colors backdrop-blur-sm w-10 h-10 flex items-center justify-center'
                            >
                              <FontAwesomeIcon
                                icon={faLocationCrosshairs}
                                size='sm'
                              />
                            </button>
                          </div>

                          {/* EVACUATION PLAN OVERLAY */}
                          <div className='absolute top-16 left-4 w-72 bg-white/95 shadow-lg border border-slate-200 rounded-lg p-5 z-500 backdrop-blur-sm'>
                            <div className='flex items-center gap-2 mb-4 border-b border-slate-100 pb-2'>
                              <div className='bg-red-600 p-1.5 rounded-lg'>
                                <FontAwesomeIcon
                                  icon={faShieldHeart}
                                  className='text-white text-xs'
                                />
                              </div>
                              <span className='text-[11px] font-black text-slate-800 uppercase leading-tight'>
                                Evacuation Plan:
                                <br />
                                Sta. Maria, Bulacan
                              </span>
                            </div>

                            <div className='space-y-4'>
                              <div className='space-y-1'>
                                <h4 className='text-[10px] font-black uppercase text-slate-800'>
                                  1. Prepare to Evacuate
                                </h4>
                                <div className='flex gap-2'>
                                  <input
                                    type='checkbox'
                                    defaultChecked
                                    className='mt-0.5 accent-blue-600'
                                  />
                                  <p className='text-[10px] leading-relaxed italic text-slate-600 font-medium'>
                                    Get your go-bag, mobile phone, PWD ID, and
                                    medication.
                                  </p>
                                </div>
                              </div>

                              <div className='space-y-1 pt-1'>
                                <h4 className='text-[10px] font-black uppercase text-slate-800'>
                                  2. Proceed to Evacuation Center
                                </h4>
                                <div className='flex gap-2'>
                                  <div className='bg-blue-700 text-white text-[9px] px-2 py-0.5 rounded h-fit mt-0.5 font-bold uppercase shadow-sm'>
                                    SOS
                                  </div>
                                  <p className='text-[10px] leading-relaxed italic text-slate-600 font-medium'>
                                    Go to nearest center or contact a response
                                    team if you need assistance.
                                  </p>
                                </div>
                                <a
                                  href={this.getDirectionsUrl(
                                    selectedCenter.position,
                                  )}
                                  target='_blank'
                                  rel='noreferrer'
                                  className='inline-flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase'
                                >
                                  <FontAwesomeIcon icon={faRoute} /> Get
                                  Directions
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* EMERGENCY CONTACTS OVERLAY */}
                          <div className='absolute bottom-4 left-4 w-72 bg-white/95 shadow-lg border border-slate-200 rounded-lg p-4 z-500 hidden lg:block'>
                            <div className='flex items-center gap-2 mb-2'>
                              <FontAwesomeIcon
                                icon={faShieldHeart}
                                className='text-blue-700 text-sm'
                              />
                              <span className='text-xs font-black text-slate-800 uppercase'>
                                Emergency Contacts
                              </span>
                            </div>
                            <p className='text-[10px] font-bold text-slate-500 tracking-widest uppercase'>
                              Sta. Maria Municipal Hall
                            </p>
                            <a
                              href='tel:+6944812 3400'
                              className='text-sm font-black text-slate-700 underline decoration-blue-200 hover:text-blue-700'
                            >
                              +69 44 812 3400
                            </a>
                            <div className='mt-3'>
                              <label
                                htmlFor='sos-disaster-type'
                                className='block text-[10px] font-black text-slate-700 uppercase tracking-wide mb-1'
                              >
                                SOS Disaster Type
                              </label>
                              <select
                                id='sos-disaster-type'
                                value={selectedSosDisasterType}
                                onChange={this.handleSosDisasterTypeChange}
                                className='w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200'
                              >
                                <option value=''>
                                  -- Select disaster type --
                                </option>
                                {SOS_DISASTER_TYPE_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className='mt-3 grid grid-cols-2 gap-2'>
                              <button
                                onClick={this.handleTriggerSosAndShare}
                                disabled={
                                  isSosLocked || !selectedSosDisasterType
                                }
                                className='bg-red-600 text-white font-black py-2 rounded-xl text-[10px] hover:bg-red-700 uppercase tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-red-600 cursor-pointer'
                              >
                                {isSosLocked
                                  ? "SOS Active (Resolve First)"
                                  : "Trigger SOS + Share"}
                              </button>
                              {isSharingLocation ? (
                                <button
                                  onClick={this.handleStopLocationShare}
                                  className='bg-slate-700 text-white font-black py-2 rounded-xl text-[10px] hover:bg-slate-800 uppercase tracking-wide transition-all'
                                >
                                  Stop Sharing
                                </button>
                              ) : (
                                <div className='bg-blue-50 border border-blue-100 text-blue-700 font-black py-2 rounded-xl text-[10px] uppercase tracking-wide text-center'>
                                  Share on SOS
                                </div>
                              )}
                            </div>
                            <div className='mt-3 space-y-1 border-t border-slate-200 pt-2'>
                              <p className='text-[10px] font-bold text-slate-700 uppercase'>
                                SOS timestamp:{" "}
                                <span className='text-slate-500'>
                                  {sosTimestampLabel}
                                </span>
                              </p>
                              <p className='text-[10px] font-bold text-slate-700 uppercase'>
                                Shared location duration:{" "}
                                <span className='text-slate-500'>
                                  {locationShareDurationLabel}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className='mt-4 bg-white border border-slate-200 rounded-lg p-4 shadow-sm lg:hidden'>
                          <div className='flex items-center gap-2 mb-2'>
                            <FontAwesomeIcon
                              icon={faShieldHeart}
                              className='text-blue-700 text-sm'
                            />
                            <span className='text-xs font-black text-slate-800 uppercase'>
                              Emergency Contacts
                            </span>
                          </div>
                          <p className='text-[10px] font-bold text-slate-500 tracking-widest uppercase'>
                            Sta. Maria Municipal Hall
                          </p>
                          <a
                            href='tel:+69448123400'
                            className='text-sm font-black text-slate-700 underline decoration-blue-200 hover:text-blue-700'
                          >
                            +69 44 812 3400
                          </a>
                          <div className='mt-3'>
                            <label
                              htmlFor='sos-disaster-type-mobile'
                              className='block text-[10px] font-black text-slate-700 uppercase tracking-wide mb-1'
                            >
                              SOS Disaster Type
                            </label>
                            <select
                              id='sos-disaster-type-mobile'
                              value={selectedSosDisasterType}
                              onChange={this.handleSosDisasterTypeChange}
                              className='w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200'
                            >
                              <option value=''>
                                -- Select disaster type --
                              </option>
                              {SOS_DISASTER_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className='mt-3 grid grid-cols-2 gap-2'>
                            <button
                              onClick={this.handleTriggerSosAndShare}
                              disabled={isSosLocked || !selectedSosDisasterType}
                              className='bg-red-600 text-white font-black py-2 rounded-xl text-[10px] hover:bg-red-700 uppercase tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-red-600 cursor-pointer'
                            >
                              {isSosLocked
                                ? "SOS Active (Resolve First)"
                                : "Trigger SOS + Share"}
                            </button>
                            {isSharingLocation ? (
                              <button
                                onClick={this.handleStopLocationShare}
                                className='bg-slate-700 text-white font-black py-2 rounded-xl text-[10px] hover:bg-slate-800 uppercase tracking-wide transition-all'
                              >
                                Stop Sharing
                              </button>
                            ) : (
                              <div className='bg-blue-50 border border-blue-100 text-blue-700 font-black py-2 rounded-xl text-[10px] uppercase tracking-wide text-center'>
                                Share on SOS
                              </div>
                            )}
                          </div>
                          <div className='mt-3 space-y-1 border-t border-slate-200 pt-2'>
                            <p className='text-[10px] font-bold text-slate-700 uppercase'>
                              SOS timestamp:{" "}
                              <span className='text-slate-500'>
                                {sosTimestampLabel}
                              </span>
                            </p>
                            <p className='text-[10px] font-bold text-slate-700 uppercase'>
                              Shared location duration:{" "}
                              <span className='text-slate-500'>
                                {locationShareDurationLabel}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* SIDEBAR SECTION */}
                  <section className='lg:col-span-4 space-y-4 scroll-mt-44'>
                    <div>
                      <div className='bg-white border border-gray-200 rounded-lg p-2 shadow-sm mb-2 w-fit'>
                        <button
                          className='relative focus:outline-none'
                          onClick={this.toggleNotificationWidgetCollapsed}
                          aria-label={notificationWidgetCollapsed ? `Show notifications${notificationItems.length > 0 ? `, ${notificationItems.length} unread` : ''}` : 'Hide notifications'}
                          aria-expanded={!notificationWidgetCollapsed}
                          title={
                            notificationWidgetCollapsed
                              ? "Show notifications"
                              : "Hide notifications"
                          }
                        >
                          <FontAwesomeIcon
                            icon={faBell}
                            className='text-blue-700'
                          />
                          {notificationItems.length > 0 && (
                            <span className='absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5'>
                              {notificationItems.length}
                            </span>
                          )}
                        </button>
                      </div>

                      {!notificationWidgetCollapsed && (
                        <div className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'>
                          <h3 className='text-xs font-black text-slate-700 uppercase tracking-tight mb-3'>
                            Notifications Widget
                          </h3>
                          {
                            <>
                              <p className='text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3'>
                                Alerts & announcements
                              </p>
                              <div className='space-y-2'>
                                {notificationItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className='rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2'
                                  >
                                    <p className='text-[10px] font-black text-slate-800 uppercase flex items-center gap-1'>
                                      <FontAwesomeIcon
                                        icon={
                                          item.type === "announcement"
                                            ? faBullhorn
                                            : faShieldHeart
                                        }
                                        className={
                                          item.type === "sos"
                                            ? "text-red-600"
                                            : "text-blue-700"
                                        }
                                      />
                                      {item.title}
                                    </p>
                                    <p className='text-[10px] font-medium text-slate-600 mt-0.5'>
                                      {item.description}
                                    </p>
                                    {item.disasterTypeLabel && (
                                      <p className='text-[9px] font-black text-red-600 mt-1 uppercase'>
                                        Disaster type: {item.disasterTypeLabel}
                                      </p>
                                    )}
                                    {item.meta && (
                                      <p className='text-[9px] font-semibold text-slate-400 mt-1 uppercase'>
                                        {item.meta}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </>
                          }
                        </div>
                      )}
                    </div>

                    <h3 className='text-xs font-black text-slate-500 uppercase tracking-[0.18em]'>
                      Recommended Sites
                    </h3>
                    <div className='h-44 w-full border border-slate-200 rounded-lg relative overflow-hidden shadow-sm z-0 bg-white'>
                      <MapView
                        mapLib={maplibregl}
                        mapStyle={MAP_STYLE}
                        longitude={mapCenter[0]}
                        latitude={mapCenter[1]}
                        zoom={13}
                        dragPan={false}
                        scrollZoom={false}
                        doubleClickZoom={false}
                        touchZoomRotate={false}
                        keyboard={false}
                        style={{ height: "100%", width: "100%" }}
                      >
                        {centers.map((center) => {
                          const lngLat = toLngLat(center.position);
                          if (!lngLat) return null;
                          return (
                            <Marker
                              key={`mini-${center.id}`}
                              longitude={lngLat[0]}
                              latitude={lngLat[1]}
                              anchor='bottom'
                            >
                              <div className='flex flex-col items-center gap-1'>
                                <div className='map-pin-label map-pin-label--mini'>
                                  {center.name}
                                </div>
                                {renderCenterPin(center.isFull, true)}
                              </div>
                            </Marker>
                          );
                        })}
                      </MapView>
                      <div className='absolute top-2 right-2 z-500'>
                        <button className='bg-white/95 px-2 py-1 rounded-full text-[10px] font-black shadow-sm border border-slate-200 uppercase'>
                          SATELLITE
                        </button>
                      </div>
                    </div>

                    <div className='space-y-3'>
                      {centers.map((center) => this.renderEvacCard(center))}
                    </div>
                  </section>
                </main>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ResidentDashboard;
