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
} from "@fortawesome/free-solid-svg-icons";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
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

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

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
          capacity: 120,
          current: 79,
          status: "available",
          coordinates: [14.8285, 120.9577], // Sta. Maria, Bulacan coordinates
        },
        {
          id: 2,
          name: "Cabuyao Elementary",
          location: "Cabuyao, Sta. Maria, Bulacan",
          capacity: 100,
          current: 97,
          status: "warning",
          coordinates: [14.8325, 120.9647],
        },
        {
          id: 3,
          name: "San Isidro Chapel",
          location: "San Isidro, Sta. Maria, Bulacan",
          capacity: 25,
          current: 20,
          status: "available",
          coordinates: [14.8245, 120.9517],
        },
      ],

      // Map center (Sta. Maria, Bulacan)
      mapCenter: [14.8285, 120.9577],
      mapZoom: 14,
      mapDisplayMode: "sector-view",

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
      postingAnnouncement: false,
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
    this.getEmergencyEventTimeLabel =
      this.getEmergencyEventTimeLabel.bind(this);
    this.handleAnnouncementTitleInput =
      this.handleAnnouncementTitleInput.bind(this);
    this.handleAnnouncementInput = this.handleAnnouncementInput.bind(this);
    this.handleAnnouncementTargetChange =
      this.handleAnnouncementTargetChange.bind(this);
    this.handlePostAnnouncement = this.handlePostAnnouncement.bind(this);
    this.handleMapModeChange = this.handleMapModeChange.bind(this);
    this.handleQrScanInputChange = this.handleQrScanInputChange.bind(this);
    this.handleQrLookup = this.handleQrLookup.bind(this);
    this.getEventCoordinates = this.getEventCoordinates.bind(this);
    this.startUserProfileListener = this.startUserProfileListener.bind(this);
    this.handleGovProfileMenuToggle =
      this.handleGovProfileMenuToggle.bind(this);
    this.handleGovProfileMenuClose = this.handleGovProfileMenuClose.bind(this);
    this.handleGovDropdownLogout = this.handleGovDropdownLogout.bind(this);
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

    const capacityRef = collection(AuthService.db, "evacuationCenterCapacity");

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
            name: data.centerName,
            location: data.address,
            capacity: Number(data.capacity),
            headcount: Number(data.headcount),
          });
        });

        this.setState((prevState) => {
          const merged = prevState.evacuationCenters.map((center) => {
            const update = updatesByCenterId.get(String(center.id));
            if (!update) {
              return center;
            }

            const nextCapacity =
              Number.isFinite(update.capacity) && update.capacity > 0
                ? update.capacity
                : center.capacity;
            const rawHeadcount =
              Number.isFinite(update.headcount) && update.headcount >= 0
                ? update.headcount
                : center.current;
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

          const existingIds = new Set(
            merged.map((center) => String(center.id)),
          );
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
          };
        });
      },
      (error) => {
        console.error(
          "[GovernmentDashboard] Failed to auto-load center capacity:",
          error,
        );
      },
    );
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
      }, 8);
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

  handleMapModeChange(mode) {
    this.setState({ mapDisplayMode: mode });
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
    const lat = Number(event?.coordinates?.lat);
    const lng = Number(event?.coordinates?.lng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }

    return null;
  }

  async handlePostAnnouncement() {
    const {
      announcementTitle,
      announcementText,
      announcementTargetGroup,
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
        message,
      });
      this.setState({
        announcementTitle: "",
        announcementText: "",
        announcementTargetGroup: "all",
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
   * Create custom marker icon
   * @private
   */
  createMarkerIcon(color) {
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          background-color: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
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
      postingAnnouncement,
      mapDisplayMode,
      mapCenter,
      mapZoom,
      qrScanValue,
      qrScanResult,
      qrScanError,
    } = this.state;
    const recentFeedEvents = emergencyEvents.slice(0, 8);
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
      activeSosEvents.length > 0 ? "Activated" : "Standby";

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
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                />

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

                    return (
                      <React.Fragment key={`sector-${barangayItem.id}`}>
                        <Circle
                          center={barangayItem.coordinates}
                          radius={350 + densityRatio * 450}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.25,
                            weight: 2,
                          }}
                        />
                        <Marker
                          position={barangayItem.coordinates}
                          icon={this.createMarkerIcon(color)}
                        >
                          <Tooltip
                            permanent
                            direction='top'
                            offset={[0, -20]}
                            opacity={0.95}
                            className='map-pin-label map-pin-label--full'
                          >
                            {barangayItem.sectorLabel}
                          </Tooltip>
                          <Popup>
                            <div className='text-xs'>
                              <p className='font-black text-[#3a4a5b]'>
                                {barangayItem.sectorLabel}
                              </p>
                              <p className='text-gray-700'>
                                PWD Cluster: {barangayItem.pwdClusterCount}
                              </p>
                              <p className='text-gray-600'>
                                Residents tagged: {barangayItem.residentsCount}
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      </React.Fragment>
                    );
                  })}

                {effectiveMapMode === "sos-view" &&
                  activeSosEvents.map((event, index) => {
                    const coordinates = this.getEventCoordinates(event);
                    const user = getUserByEvent(event);
                    const medicalFlag =
                      event.medicalNeeds ||
                      user?.medicalInfo ||
                      (user?.bloodType
                        ? `Blood Type: ${user.bloodType}`
                        : "None");
                    if (!coordinates) return null;

                    return (
                      <Marker
                        key={`sos-${event.id || index}`}
                        position={coordinates}
                        icon={this.createMarkerIcon("#dc2626")}
                      >
                        <Tooltip
                          permanent
                          direction='top'
                          offset={[0, -20]}
                          opacity={0.95}
                          className='map-pin-label map-pin-label--full'
                        >
                          {event.userName || "SOS Alert"}
                        </Tooltip>
                        <Popup>
                          <div className='text-xs'>
                            <p className='font-black text-red-700'>SOS Alert</p>
                            <p className='text-gray-700'>
                              {event.userName || "Resident"}
                            </p>
                            <p className='text-gray-500'>
                              {coordinates[0].toFixed(4)},{" "}
                              {coordinates[1].toFixed(4)}
                            </p>
                            <p className='text-red-700 font-semibold'>
                              Medical Flag: {medicalFlag}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                {effectiveMapMode === "evacuation-view" &&
                  evacuationCenters.map((center) => {
                    const assignedFamilies = registeredUsers.filter(
                      (user) =>
                        user.accountType === "residential-family" &&
                        ((user.assignedEvacCenterId &&
                          Number(user.assignedEvacCenterId) === center.id) ||
                          (typeof user.assignedEvacCenterName === "string" &&
                            user.assignedEvacCenterName
                              .toLowerCase()
                              .includes(center.name.toLowerCase()))),
                    ).length;
                    const arrived = Math.min(center.current, assignedFamilies);
                    const enRoute = Math.max(assignedFamilies - arrived, 0);
                    const missing = Math.max(
                      assignedFamilies - arrived - enRoute,
                      Math.round(assignedFamilies * 0.1),
                    );

                    return (
                      <Marker
                        key={`center-${center.id}`}
                        position={center.coordinates}
                        icon={this.createMarkerIcon(
                          this.getMarkerColor(center.current, center.capacity),
                        )}
                      >
                        <Tooltip
                          permanent
                          direction='top'
                          offset={[0, -20]}
                          opacity={0.95}
                          className='map-pin-label map-pin-label--full'
                        >
                          {center.name}
                        </Tooltip>
                        <Popup>
                          <div className='text-xs min-w-44'>
                            <p className='font-black text-[#3a4a5b]'>
                              {center.name}
                            </p>
                            <p className='text-gray-600'>
                              Capacity: {center.current}/{center.capacity}
                            </p>
                            <p className='text-gray-700 mt-1'>
                              Assigned Families: {assignedFamilies}
                            </p>
                            <div className='mt-2 flex gap-1.5 flex-wrap'>
                              <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700'>
                                Arrived: {arrived}
                              </span>
                              <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700'>
                                En Route: {enRoute}
                              </span>
                              <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700'>
                                Missing: {missing}
                              </span>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
              </MapContainer>
            </div>
          </div>

          <div className='xl:col-span-4 space-y-6'>
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
                <p className='text-sm text-gray-500'>No active SOS alerts.</p>
              ) : (
                <div className='space-y-2 max-h-80 overflow-y-auto pr-1'>
                  {activeSosEvents.slice(0, 8).map((event) => {
                    const user = getUserByEvent(event);
                    const coordinates = this.getEventCoordinates(event);

                    return (
                      <div
                        key={event.id}
                        className='rounded-lg border border-red-100 bg-red-50 px-3 py-2'
                      >
                        <p className='text-xs font-black text-red-700 uppercase'>
                          {event.userName || user?.fullName || "Resident"}
                        </p>
                        <p className='text-[11px] text-gray-700 mt-1'>
                          <span className='font-bold'>Location:</span>{" "}
                          {coordinates
                            ? `${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}`
                            : "Not shared"}
                        </p>
                        <p className='text-[11px] text-gray-700'>
                          <span className='font-bold'>Disability Type:</span>{" "}
                          {getDisabilityLabel(user, event)}
                        </p>
                        <p className='text-[11px] text-gray-700'>
                          <span className='font-bold'>Medical Needs:</span>{" "}
                          {getMedicalNeeds(user, event)}
                        </p>
                      </div>
                    );
                  })}
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
          <div className='border border-gray-200 rounded-lg p-3 bg-gray-50 mb-4'>
            <p className='text-xs font-black text-[#3a4a5b] uppercase mb-2'>
              Post LGU Announcement
            </p>
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
                  !announcementText.trim()
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
                  {evacuationCenters.map((center) => {
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
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className='xl:col-span-5 bg-white rounded-lg shadow-sm p-4 border border-gray-200'>
            <h3 className='text-sm font-black text-[#3a4a5b] uppercase mb-3'>
              Audit Log Snapshot
            </h3>

            {recentFeedEvents.length === 0 ? (
              <p className='text-sm text-gray-500'>No recent activity.</p>
            ) : (
              <div className='space-y-2 max-h-80 overflow-y-auto pr-1'>
                {recentFeedEvents.map((event) => {
                  const actionLabel =
                    event.type === "sos"
                      ? "SOS Triggered"
                      : event.type === "announcement"
                        ? "LGU Announcement Posted"
                        : event.type === "resolution"
                          ? "Alert Resolved"
                          : "Activity Logged";

                  return (
                    <div
                      key={`audit-${event.id}`}
                      className='rounded-lg border border-gray-200 bg-gray-50 px-3 py-2'
                    >
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>User Access:</span>{" "}
                        {event.userName || "Resident"}
                      </p>
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>Timestamp:</span>{" "}
                        {this.getEmergencyEventTimeLabel(event)}
                      </p>
                      <p className='text-xs text-gray-700'>
                        <span className='font-bold'>Action:</span> {actionLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
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
        <div className='px-4 py-4 lg:px-6 lg:py-5'>
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
