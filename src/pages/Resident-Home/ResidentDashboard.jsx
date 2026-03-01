import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  ZoomControl,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
} from "@fortawesome/free-solid-svg-icons";

// Firebase imports
import { auth, db } from "../../firebase";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";

// Component imports
import ResidentDashboardHeader from "../../components/ResidentDashboardHeader";
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

// Fix for Leaflet default marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Constants
const ORIGINAL_CENTER = [14.8193, 120.962];

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

/**
 * MapViewHandler - Quick effect component for map updates
 * @private
 */
function MapViewHandler({ center, recenterSignal }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, 15, { animate: true });
  }, [center, recenterSignal, map]);
  return null;
}

function createCenterMarkerIcon(isFull, mini = false) {
  const size = mini ? 20 : 26;
  const bgColor = isFull ? "#dc2626" : "#2563eb";
  const ringColor = isFull ? "#fecaca" : "#bfdbfe";
  const iconSymbol = isFull ? "!" : "✓";

  return L.divIcon({
    className: "custom-center-marker",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${bgColor};
      border:2px solid ${ringColor};
      box-shadow:0 3px 10px rgba(15,23,42,0.28);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-weight:900;
      font-size:${mini ? 11 : 13}px;
      line-height:1;
    ">${iconSymbol}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
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
      position: [14.821, 120.963],
      capacity: "79 / 120 Capacity",
      percent: 65,
      tag: "Wheelchair Accessible",
      tagIcon: faWheelchair,
      blood: "B+",
      isFull: false,
    },
    {
      id: 2,
      name: "Cabayao Elementary School",
      address: "Cabayao St., Sta. Maria, Bulacan",
      position: [14.815, 120.958],
      capacity: "97 / 100 Capacity",
      percent: 97,
      tag: "PWD-Friendly",
      tagIcon: faUserGroup,
      blood: "B+",
      isFull: true,
    },
  ];

  constructor(props) {
    super(props);

    this.state = {
      userName: "Resident",
      userPhotoUrl: "",
      showProfileMenu: false,
      activeTab: "dashboard",
      searchQuery: "",
      mapCenter: ORIGINAL_CENTER,
      recenterSignal: 0,
      currentTime: new Date(),
      lastUpdatedAt: new Date(),
      sosTriggeredAt: null,
      isSharingLocation: false,
      locationShareStartedAt: null,
      locationShareEndsAt: null,
      shareDurationMinutes: 15,
      evacuationCenters: ResidentDashboard.EVACUATION_CENTERS.map((center) => ({
        ...center,
      })),
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
      // profileQrCode removed
    };

    // Bind methods
    this.handleSearch = this.handleSearch.bind(this);
    this.handleProfileMenuClick = this.handleProfileMenuClick.bind(this);
    this.handleReturnToOrigin = this.handleReturnToOrigin.bind(this);
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
    this.handleTriggerSOS = this.handleTriggerSOS.bind(this);
    this.handleShareLocation = this.handleShareLocation.bind(this);
    this.handleStopLocationShare = this.handleStopLocationShare.bind(this);
    this.getDirectionsUrl = this.getDirectionsUrl.bind(this);
    this.handleTabChange = this.handleTabChange.bind(this);
    this.renderActiveTabPage = this.renderActiveTabPage.bind(this);
  }

  /**
   * Component lifecycle - fetch user data on mount
   */
  componentDidMount() {
    this.fetchUserData();
    this.startUserProfileListener();
    this.startEmergencyFeedListener();
    this.startEvacuationCapacityListener();
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
            const [lat, lng] = prevState.mapCenter;
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
        userPhotoUrl: userData.photoUrl || "",
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

        snapshot.forEach((centerDoc) => {
          const data = centerDoc.data() || {};
          const rawCenterId = data.centerId ?? centerDoc.id;
          const numericCenterId = Number(rawCenterId);
          const centerId = Number.isFinite(numericCenterId)
            ? numericCenterId
            : String(rawCenterId);

          updatesByCenterId.set(String(centerId), {
            centerId,
            address: data.address,
            capacity: Number(data.capacity),
            headcount: Number(data.headcount),
          });
        });

        this.setState((prevState) => ({
          evacuationCenters: prevState.evacuationCenters.map((center) => {
            const update = updatesByCenterId.get(String(center.id));
            if (!update) {
              return center;
            }

            const fallback = parseCenterCapacityText(center.capacity);
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

            return {
              ...center,
              address: update.address || center.address,
              capacity: `${boundedHeadcount} / ${nextCapacity} Capacity`,
              percent,
              isFull: nextCapacity > 0 && boundedHeadcount >= nextCapacity,
            };
          }),
        }));
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
            userPhotoUrl: userData.photoUrl || "",
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
    this.setState((prevState) => ({
      mapCenter: [...ORIGINAL_CENTER],
      searchQuery: "",
      recenterSignal: prevState.recenterSignal + 1,
    }));
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

  getNotificationItems() {
    const {
      notifications,
      emergencyEvents,
      sosTriggeredAt,
      isSharingLocation,
      locationShareEndsAt,
      currentTime,
    } = this.state;

    const dynamicItems = [];

    if (sosTriggeredAt) {
      dynamicItems.push({
        id: "sos-live",
        type: "sos",
        title: "SOS Alert",
        description: `Triggered at ${this.getSosTimestampLabel()}.`,
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
        return {
          id: `feed-${event.id}`,
          type: "announcement",
          title: "LGU Announcement",
          description: event.message || "Official local government update.",
          meta: this.getEventTimeLabel(event),
        };
      }

      if (event.type === "sos") {
        return {
          id: `feed-${event.id}`,
          type: "sos",
          title: "SOS Alert",
          description: `${event.userName || "Resident"} triggered SOS.`,
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

  async handleTriggerSOS() {
    const now = new Date();
    const currentUser = auth.currentUser;
    const [lat, lng] = this.state.mapCenter;

    this.setState({
      sosTriggeredAt: now,
      lastUpdatedAt: now,
    });

    if (!currentUser) return;

    try {
      await EmergencyEventService.createSosEvent({
        userId: currentUser.uid,
        userName: this.state.userName,
        triggeredAt: now,
        coordinates: { lat, lng },
      });
    } catch (error) {
      console.error("Failed to persist SOS event:", error);
    }
  }

  async handleShareLocation() {
    const now = new Date();
    const { shareDurationMinutes, userName, mapCenter } = this.state;
    const currentUser = auth.currentUser;
    const endsAt = new Date(now.getTime() + shareDurationMinutes * 60000);
    const [lat, lng] = mapCenter;

    this.setState({
      isSharingLocation: true,
      locationShareStartedAt: now,
      locationShareEndsAt: endsAt,
      lastUpdatedAt: now,
    });

    if (!currentUser) return;

    try {
      await EmergencyEventService.createLocationShareEvent({
        userId: currentUser.uid,
        userName,
        startedAt: now,
        endsAt,
        durationMinutes: shareDurationMinutes,
        coordinates: { lat, lng },
      });
    } catch (error) {
      console.error("Failed to persist location sharing event:", error);
    }
  }

  async handleStopLocationShare() {
    const now = new Date();
    const {
      locationShareStartedAt,
      shareDurationMinutes,
      userName,
      mapCenter,
    } = this.state;
    const currentUser = auth.currentUser;
    const [lat, lng] = mapCenter;

    this.setState({
      isSharingLocation: false,
      locationShareStartedAt: null,
      locationShareEndsAt: null,
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
    const [lat, lng] = position;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }

  /**
   * Render EvacCard sub-component
   * @private
   */
  renderEvacCard(center) {
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
      </div>
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
      recenterSignal,
      isSharingLocation,
      accessibilitySettings,
      evacuationCenters,
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
    const accessibilityContainer = getAccessibilityContainerProps(
      accessibilitySettings,
    );

    return (
      <div
        className='min-h-screen bg-[#f3f4f6] font-sans text-slate-700'
        style={accessibilityContainer.style}
        aria-live={accessibilityContainer.ariaLive}
      >
        <ResidentDashboardHeader
          userName={userName}
          userPhotoUrl={userPhotoUrl}
          showProfileMenu={showProfileMenu}
          onProfileMenuClick={this.handleProfileMenuClick}
          activeTab={activeTab}
          onTabChange={this.handleTabChange}
          menuContent={
            <div className='absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-xl py-1 z-2001 overflow-hidden'>
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
                    this.props.onOpenSetup();
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
          }
        />

        <div className='p-6'>
          <div className='max-w-7xl mx-auto space-y-6'>
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
                        <p className='text-xs font-semibold text-slate-600 mt-2 inline-flex items-center gap-1'>
                          <FontAwesomeIcon
                            icon={faClock}
                            className='text-slate-500'
                          />
                          Last updated: {lastUpdatedLabel}
                        </p>

                        <div className='relative h-140 w-full border border-slate-200 rounded-lg overflow-hidden z-0 mt-4'>
                          <MapContainer
                            center={mapCenter}
                            zoom={14}
                            zoomControl={false}
                            style={{ height: "100%", width: "100%" }}
                          >
                            <MapViewHandler
                              center={mapCenter}
                              recenterSignal={recenterSignal}
                            />
                            <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
                            <ZoomControl position='bottomright' />
                            {centers.map((center) => (
                              <Marker
                                key={center.id}
                                position={center.position}
                                icon={createCenterMarkerIcon(
                                  center.isFull,
                                  false,
                                )}
                              >
                                <Tooltip
                                  permanent
                                  direction='top'
                                  offset={[0, -20]}
                                  opacity={0.95}
                                  className='map-pin-label'
                                >
                                  {center.name}
                                </Tooltip>
                                <Popup>
                                  <div className='text-[11px] font-bold space-y-1'>
                                    <b className='text-blue-700'>
                                      {center.name}
                                    </b>
                                    <br />
                                    {center.capacity}
                                    <div className='text-[10px] font-black text-red-600'>
                                      {center.percent >= 90
                                        ? "Near Capacity"
                                        : "Available"}
                                    </div>
                                    <a
                                      href={this.getDirectionsUrl(
                                        center.position,
                                      )}
                                      target='_blank'
                                      rel='noreferrer'
                                      className='inline-flex items-center gap-1 text-[10px] text-blue-700 font-black'
                                    >
                                      <FontAwesomeIcon icon={faRoute} /> Get
                                      Directions
                                    </a>
                                  </div>
                                </Popup>
                              </Marker>
                            ))}
                          </MapContainer>

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
                                className='w-full pl-9 pr-10 py-2 bg-white/95 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 backdrop-blur-sm'
                                value={searchQuery}
                                onChange={(e) =>
                                  this.setState({ searchQuery: e.target.value })
                                }
                                onKeyDown={this.handleSearch}
                              />
                            </div>

                            {/* RETURN TO ORIGINAL LOCATION BUTTON */}
                            <button
                              onClick={this.handleReturnToOrigin}
                              title='Return to original location'
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
                          <div className='absolute bottom-4 left-4 w-72 bg-white/95 shadow-lg border border-slate-200 rounded-lg p-4 z-500'>
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
                            <p className='text-sm font-black text-slate-700 underline decoration-blue-200'>
                              +69 44 812 3400
                            </p>
                            <div className='mt-3 grid grid-cols-2 gap-2'>
                              <button
                                onClick={this.handleTriggerSOS}
                                className='bg-red-600 text-white font-black py-2 rounded-xl text-[10px] hover:bg-red-700 uppercase tracking-wide transition-all'
                              >
                                Trigger SOS
                              </button>
                              {!isSharingLocation ? (
                                <button
                                  onClick={this.handleShareLocation}
                                  className='bg-blue-700 text-white font-black py-2 rounded-xl text-[10px] hover:bg-blue-800 uppercase tracking-wide transition-all'
                                >
                                  Share Location
                                </button>
                              ) : (
                                <button
                                  onClick={this.handleStopLocationShare}
                                  className='bg-slate-700 text-white font-black py-2 rounded-xl text-[10px] hover:bg-slate-800 uppercase tracking-wide transition-all'
                                >
                                  Stop Sharing
                                </button>
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
                    </div>
                  </section>

                  {/* SIDEBAR SECTION */}
                  <section className='lg:col-span-4 space-y-4 scroll-mt-44'>
                    <div className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'>
                      <div className='flex items-center gap-2 mb-3'>
                        <FontAwesomeIcon
                          icon={faBell}
                          className='text-blue-700'
                        />
                        <h3 className='text-xs font-black text-slate-700 uppercase tracking-tight'>
                          Notifications Widget
                        </h3>
                      </div>
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
                            {item.meta && (
                              <p className='text-[9px] font-semibold text-slate-400 mt-1 uppercase'>
                                {item.meta}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <h3 className='text-xs font-black text-slate-500 uppercase tracking-[0.18em]'>
                      Recommended Sites
                    </h3>
                    <div className='h-44 w-full border border-slate-200 rounded-lg relative overflow-hidden shadow-sm z-0 bg-white'>
                      <MapContainer
                        center={mapCenter}
                        zoom={13}
                        zoomControl={false}
                        attributionControl={false}
                        dragging={false}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
                        {centers.map((center) => (
                          <Marker
                            key={`mini-${center.id}`}
                            position={center.position}
                            icon={createCenterMarkerIcon(center.isFull, true)}
                          >
                            <Tooltip
                              permanent
                              direction='top'
                              offset={[0, -18]}
                              opacity={0.9}
                              className='map-pin-label map-pin-label--mini'
                            >
                              {center.name}
                            </Tooltip>
                          </Marker>
                        ))}
                      </MapContainer>
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
