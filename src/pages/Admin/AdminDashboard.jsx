import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHeart,
  faRightFromBracket,
  faUserShield,
  faUsers,
  faBell,
  faBullhorn,
  faChartLine,
  faCheckCircle,
  faClock,
  faTimesCircle,
  faSpinner,
  faSearch,
  faFilter,
  faArrowLeft,
  faBan,
  faUserCheck,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { collection, doc, onSnapshot } from "firebase/firestore";
import Header from "../../components/Header";
import AuthService from "../../services/AuthService";
import EmergencyEventService from "../../services/EmergencyEventService";
import {
  getAccessibilityContainerProps,
  normalizeAccessibilitySettings,
} from "../../services/AccessibilityViewUtils";

function getDateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatShare(part, total) {
  if (!total) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

/**
 * AdminDashboard - OOP Class-based Component
 * Main admin dashboard for system administrators
 */
class AdminDashboard extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      adminName: "Administrator",
      adminId: null,
      stats: {
        totalUsers: 0,
        pendingApprovals: 0,
        activeGovernment: 0,
      },
      pendingAccounts: [],
      allUsers: [],
      filteredUsers: [],
      loading: true,
      error: null,
      processingAccountId: null,
      updatingUserStatusId: null,
      showAdminProfileMenu: false,
      activeView: "dashboard", // dashboard, users, analytics, settings
      searchTerm: "",
      filterRole: "all",
      emergencyEvents: [],
      emergencyFeedLoading: true,
      analyticsEmergencyEvents: [],
      responseResponders: [],
      responseTeams: [],
      responseDeployments: [],
      evacuationCenters: [],
      accessibilitySettings: {
        screenReader: false,
        highContrast: false,
        largeText: false,
      },
    };

    this.pendingAccountsRef = React.createRef();

    this.handleLogout = this.handleLogout.bind(this);
    this.handleApprove = this.handleApprove.bind(this);
    this.handleReject = this.handleReject.bind(this);
    this.handleGovernmentStatusChange =
      this.handleGovernmentStatusChange.bind(this);
    this.loadDashboardData = this.loadDashboardData.bind(this);
    this.scrollToPendingAccounts = this.scrollToPendingAccounts.bind(this);
    this.setActiveView = this.setActiveView.bind(this);
    this.loadAllUsers = this.loadAllUsers.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.filterUsers = this.filterUsers.bind(this);
    this.startEmergencyFeedListener =
      this.startEmergencyFeedListener.bind(this);
    this.startUsersListener = this.startUsersListener.bind(this);
    this.startAnalyticsListeners = this.startAnalyticsListeners.bind(this);
    this.getEmergencyEventTimeLabel =
      this.getEmergencyEventTimeLabel.bind(this);
    this.startUserProfileListener = this.startUserProfileListener.bind(this);
    this.getFilteredUsers = this.getFilteredUsers.bind(this);
    this.isGovernmentAccountActive = this.isGovernmentAccountActive.bind(this);
    this.getDisplayStatus = this.getDisplayStatus.bind(this);
    this.getUserDisplayName = this.getUserDisplayName.bind(this);
    this.handleAdminProfileMenuToggle =
      this.handleAdminProfileMenuToggle.bind(this);
    this.handleAdminProfileMenuClose =
      this.handleAdminProfileMenuClose.bind(this);
    this.handleAdminDropdownLogout =
      this.handleAdminDropdownLogout.bind(this);
  }

  getUserDisplayName(user) {
    if (user?.accountType === "residential-family") {
      return (
        user?.familyProfile?.householdName ||
        user?.familyProfile?.householdHead ||
        user?.fullName ||
        user?.agencyName ||
        "N/A"
      );
    }

    return (
      user?.personalInfo?.fullName ||
      user?.fullName ||
      user?.agencyName ||
      "N/A"
    );
  }

  isGovernmentAccountActive(user) {
    if (user?.role !== "government") return false;
    const normalizedStatus = String(user?.status || "").toLowerCase();
    return normalizedStatus === "active" || normalizedStatus === "approved";
  }

  getDisplayStatus(user) {
    if (!user?.status) {
      return "active";
    }

    if (this.isGovernmentAccountActive(user)) {
      return "active";
    }

    return String(user.status).toLowerCase();
  }

  /**
   * Load dashboard data on mount
   */
  async componentDidMount() {
    // Wait for auth state to be ready
    const unsubscribe = AuthService.onAuthStateChange(async (user) => {
      if (user) {
        await this.loadDashboardData();
        this.startUsersListener();
        this.startAnalyticsListeners();
        this.startEmergencyFeedListener();
        this.startUserProfileListener(user.uid);
      }
    });

    // Clean up subscription
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
    if (this.usersUnsubscribe) {
      this.usersUnsubscribe();
    }
    if (this.analyticsEmergencyUnsubscribe) {
      this.analyticsEmergencyUnsubscribe();
    }
    if (this.responseRespondersUnsubscribe) {
      this.responseRespondersUnsubscribe();
    }
    if (this.responseTeamsUnsubscribe) {
      this.responseTeamsUnsubscribe();
    }
    if (this.responseDeploymentsUnsubscribe) {
      this.responseDeploymentsUnsubscribe();
    }
    if (this.evacuationCentersUnsubscribe) {
      this.evacuationCentersUnsubscribe();
    }
    if (this.userProfileUnsubscribe) {
      this.userProfileUnsubscribe();
    }
  }

  startUsersListener() {
    if (this.usersUnsubscribe) {
      this.usersUnsubscribe();
    }

    const usersRef = collection(AuthService.db, "users");
    this.usersUnsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const users = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
        }));
        const pendingAccounts = users.filter(
          (user) => user.role === "government" && user.status === "pending",
        );
        const activeGovernment = users.filter(
          (user) => this.isGovernmentAccountActive(user),
        ).length;

        this.setState((prevState) => ({
          allUsers: users,
          filteredUsers: this.getFilteredUsers(
            users,
            prevState.searchTerm,
            prevState.filterRole,
          ),
          pendingAccounts,
          stats: {
            ...prevState.stats,
            totalUsers: users.length,
            pendingApprovals: pendingAccounts.length,
            activeGovernment,
          },
          loading: false,
          error:
            prevState.error === "Failed to load users." ? null : prevState.error,
        }));
      },
      (error) => {
        console.error("[AdminDashboard] Failed to subscribe to users:", error);
        this.setState({
          error: "Failed to load analytics data from Firebase.",
          loading: false,
        });
      },
    );
  }

  startAnalyticsListeners() {
    if (this.analyticsEmergencyUnsubscribe) {
      this.analyticsEmergencyUnsubscribe();
    }
    if (this.responseRespondersUnsubscribe) {
      this.responseRespondersUnsubscribe();
    }
    if (this.responseTeamsUnsubscribe) {
      this.responseTeamsUnsubscribe();
    }
    if (this.responseDeploymentsUnsubscribe) {
      this.responseDeploymentsUnsubscribe();
    }
    if (this.evacuationCentersUnsubscribe) {
      this.evacuationCentersUnsubscribe();
    }

    this.analyticsEmergencyUnsubscribe = onSnapshot(
      collection(AuthService.db, "emergencyEvents"),
      (snapshot) => {
        this.setState({
          analyticsEmergencyEvents: snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          })),
        });
      },
      (error) => {
        console.error(
          "[AdminDashboard] Failed to subscribe to emergency events:",
          error,
        );
      },
    );

    this.responseRespondersUnsubscribe = onSnapshot(
      collection(AuthService.db, "govResponseResponders"),
      (snapshot) => {
        this.setState({
          responseResponders: snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          })),
        });
      },
      (error) => {
        console.error(
          "[AdminDashboard] Failed to subscribe to responders:",
          error,
        );
      },
    );

    this.responseTeamsUnsubscribe = onSnapshot(
      collection(AuthService.db, "govResponseTeams"),
      (snapshot) => {
        this.setState({
          responseTeams: snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          })),
        });
      },
      (error) => {
        console.error(
          "[AdminDashboard] Failed to subscribe to response teams:",
          error,
        );
      },
    );

    this.responseDeploymentsUnsubscribe = onSnapshot(
      collection(AuthService.db, "govResponseDeployments"),
      (snapshot) => {
        this.setState({
          responseDeployments: snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          })),
        });
      },
      (error) => {
        console.error(
          "[AdminDashboard] Failed to subscribe to deployments:",
          error,
        );
      },
    );

    this.evacuationCentersUnsubscribe = onSnapshot(
      collection(AuthService.db, "evacuationCenterCapacity"),
      (snapshot) => {
        this.setState({
          evacuationCenters: snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          })),
        });
      },
      (error) => {
        console.error(
          "[AdminDashboard] Failed to subscribe to evacuation center capacity:",
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
      }, 10);
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

  /**
   * Load all dashboard data
   * @private
   */
  async loadDashboardData() {
    this.setState({ loading: true, error: null });

    try {
      console.log("[AdminDashboard] Starting to load dashboard data...");

      // Get current admin user
      const currentUser = AuthService.auth.currentUser;

      if (!currentUser) {
        console.error("[AdminDashboard] No authenticated user found");
        throw new Error("No authenticated user found. Please log in again.");
      }

      console.log("[AdminDashboard] Current user ID:", currentUser.uid);

      const userData = await AuthService.getUserData(currentUser.uid);

      if (!userData) {
        console.error("[AdminDashboard] User data not found in database");
        throw new Error("User data not found in database.");
      }

      console.log("[AdminDashboard] User data loaded:", userData.role);

      this.setState({
        adminName:
          userData?.agencyName || userData?.fullName || "Administrator",
        adminId: currentUser.uid,
      });

      console.log("[AdminDashboard] Fetching stats and pending accounts...");

      // Fetch all stats and pending accounts
      const [totalUsers, activeGovernment, pendingAccounts] = await Promise.all(
        [
          AuthService.getTotalUserCount(),
          AuthService.getActiveGovernmentCount(),
          AuthService.getPendingGovernmentAccounts(),
        ],
      );

      console.log("[AdminDashboard] Data loaded successfully:", {
        totalUsers,
        activeGovernment,
        pendingAccountsCount: pendingAccounts.length,
      });

      this.setState({
        stats: {
          totalUsers,
          pendingApprovals: pendingAccounts.length,
          activeGovernment,
        },
        pendingAccounts,
        loading: false,
      });
    } catch (error) {
      console.error("[AdminDashboard] Failed to load dashboard data:", error);
      console.error("[AdminDashboard] Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      let errorMessage = "Failed to load dashboard data. ";

      // Provide specific error messages based on error type
      if (error.code === "permission-denied") {
        errorMessage +=
          "Permission denied. Check your Firestore security rules.";
      } else if (error.code === "unavailable") {
        errorMessage +=
          "Firestore service is unavailable. Check your internet connection.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please try again or check the console for details.";
      }

      this.setState({
        error: errorMessage,
        loading: false,
      });
    }
  }

  /**
   * Handle approve government account
   * @private
   */
  async handleApprove(accountId) {
    if (!this.state.adminId) return;

    this.setState({ processingAccountId: accountId });

    try {
      await AuthService.approveGovernmentAccount(accountId, this.state.adminId);
      // Reload dashboard data
      await this.loadDashboardData();
      this.setState({ processingAccountId: null });
    } catch (error) {
      console.error("Failed to approve account:", error);
      alert("Failed to approve account. Please try again.");
      this.setState({ processingAccountId: null });
    }
  }

  /**
   * Handle reject government account
   * @private
   */
  async handleReject(accountId) {
    if (!this.state.adminId) return;

    const confirmed = window.confirm(
      "Are you sure you want to reject this government account?",
    );
    if (!confirmed) return;

    this.setState({ processingAccountId: accountId });

    try {
      await AuthService.rejectGovernmentAccount(accountId, this.state.adminId);
      // Reload dashboard data
      await this.loadDashboardData();
      this.setState({ processingAccountId: null });
    } catch (error) {
      console.error("Failed to reject account:", error);
      alert("Failed to reject account. Please try again.");
      this.setState({ processingAccountId: null });
    }
  }

  async handleGovernmentStatusChange(userId, nextStatus) {
    if (!this.state.adminId || !userId || !nextStatus) return;

    this.setState({ updatingUserStatusId: userId });

    try {
      await AuthService.updateUserAccountStatus(userId, nextStatus, this.state.adminId);
      this.setState({ updatingUserStatusId: null });
    } catch (error) {
      console.error("Failed to update government account status:", error);
      alert("Failed to update government account status. Please try again.");
      this.setState({ updatingUserStatusId: null });
    }
  }

  handleAdminProfileMenuToggle(event) {
    if (event?.stopPropagation) event.stopPropagation();
    this.setState((prevState) => ({
      showAdminProfileMenu: !prevState.showAdminProfileMenu,
    }));
  }

  handleAdminProfileMenuClose(event) {
    if (event?.stopPropagation) event.stopPropagation();
    this.setState({ showAdminProfileMenu: false });
  }

  async handleAdminDropdownLogout(event) {
    if (event?.stopPropagation) event.stopPropagation();
    this.setState({ showAdminProfileMenu: false });
    await this.handleLogout();
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

  /**
   * Scroll to pending accounts section
   * @private
   */
  scrollToPendingAccounts() {
    if (this.pendingAccountsRef.current) {
      this.pendingAccountsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  /**
   * Set active view
   * @private
   */
  async setActiveView(view) {
    this.setState({ activeView: view });

    // Load users when switching to users view
    if (
      (view === "users" || view === "analytics") &&
      this.state.allUsers.length === 0
    ) {
      await this.loadAllUsers();
    }
  }

  getFilteredUsers(users, searchTerm, filterRole) {
    let filtered = users;

    if (filterRole !== "all") {
      filtered = filtered.filter((user) => user.role === filterRole);
    }

    if (searchTerm) {
      const normalizedSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.fullName?.toLowerCase().includes(normalizedSearchTerm) ||
          user.email?.toLowerCase().includes(normalizedSearchTerm) ||
          user.agencyName?.toLowerCase().includes(normalizedSearchTerm) ||
          user.personalInfo?.fullName
            ?.toLowerCase()
            .includes(normalizedSearchTerm) ||
          user.familyProfile?.householdName
            ?.toLowerCase()
            .includes(normalizedSearchTerm) ||
          user.familyProfile?.householdHead
            ?.toLowerCase()
            .includes(normalizedSearchTerm),
      );
    }

    return filtered;
  }

  /**
   * Load all users
   * @private
   */
  async loadAllUsers() {
    this.setState({ loading: true });

    try {
      const { collection, getDocs } = await import("firebase/firestore");
      const usersRef = collection(AuthService.db, "users");
      const querySnapshot = await getDocs(usersRef);
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      this.setState({
        allUsers: users,
        filteredUsers: users,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to load users:", error);
      this.setState({
        error: "Failed to load users.",
        loading: false,
      });
    }
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
    const filterRole = e.target.value;
    this.setState({ filterRole }, () => {
      this.filterUsers();
    });
  }

  /**
   * Filter users based on search and filter
   * @private
   */
  filterUsers() {
    const { allUsers, searchTerm, filterRole } = this.state;

    this.setState({
      filteredUsers: this.getFilteredUsers(allUsers, searchTerm, filterRole),
    });
  }

  /**
   * Render dashboard view
   * @private
   */
  renderDashboard() {
    const {
      stats,
      pendingAccounts,
      loading,
      error,
      processingAccountId,
      emergencyEvents,
      emergencyFeedLoading,
    } = this.state;
    const recentFeedEvents = emergencyEvents.slice(0, 6);
    const activeFeedEvents = recentFeedEvents.filter(
      (event) =>
        event.type !== "resolution" &&
        event.status !== "stopped" &&
        event.status !== "resolved",
    );
    const resolvedFeedEvents = recentFeedEvents.filter(
      (event) =>
        !activeFeedEvents.some((activeEvent) => activeEvent.id === event.id),
    );

    const renderFeedCard = (event) => {
      const isGovernmentResolver =
        event.role === "government" ||
        event.accountType === "government" ||
        String(event.userName || "")
          .toLowerCase()
          .includes("government");
      const resolverDisplayName =
        String(event.userName || "").trim() ||
        (isGovernmentResolver ? "Government account" : "Resident account");
      const sourceTypeLabel =
        event.sourceType === "sos"
          ? "SOS"
          : event.sourceType === "location-share"
            ? "Location Share"
            : "Alert";
      const eventTypeLabel =
        event.type === "sos"
          ? "SOS Alert"
          : event.type === "announcement"
            ? "LGU Announcement"
            : event.type === "resolution"
              ? `Resolved: ${sourceTypeLabel}`
              : event.status === "stopped"
                ? "Location Share Stopped"
                : "Location Share Active";

      return (
        <div
          key={event.id}
          className='rounded-lg border border-gray-200 bg-gray-50 p-3'
        >
          <p className='text-xs font-black uppercase text-[#3a4a5b] flex items-center gap-1'>
            <FontAwesomeIcon
              icon={
                event.type === "sos"
                  ? faShieldHeart
                  : event.type === "resolution"
                    ? faCheckCircle
                    : faBullhorn
              }
              className={
                event.type === "sos"
                  ? "text-red-600"
                  : event.type === "resolution"
                    ? "text-green-600"
                    : "text-blue-600"
              }
            />
            {eventTypeLabel}
          </p>
          <p className='text-sm font-bold text-gray-700 mt-1'>
            {resolverDisplayName}
          </p>
          <p className='text-xs text-gray-500 mt-0.5'>
            {event.type === "resolution"
              ? `${
                  event.resolutionNote || `Resolved by ${resolverDisplayName}`
                } (${sourceTypeLabel})`
              : event.type === "sos"
                ? `${event.userName || "Resident"} triggered SOS at ${event.locationLabel || "Pinned location"}.`
                : event.message ||
                  (event.durationMinutes
                    ? `${event.durationMinutes}-minute temporary share`
                    : "Emergency update")}
          </p>
          <p className='text-[11px] text-gray-400 mt-1'>
            {this.getEmergencyEventTimeLabel(event)}
          </p>
        </div>
      );
    };

    return (
      <>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
          <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs font-bold text-gray-500 uppercase'>
                  Total Users
                </p>
                <p className='text-3xl font-black text-[#3a4a5b] mt-2'>
                  {stats.totalUsers}
                </p>
              </div>
              <div className='bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center'>
                <FontAwesomeIcon
                  icon={faUsers}
                  className='text-blue-600'
                  size='lg'
                />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs font-bold text-gray-500 uppercase'>
                  Pending Approvals
                </p>
                <p className='text-3xl font-black text-orange-600 mt-2'>
                  {stats.pendingApprovals}
                </p>
              </div>
              <div className='bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center'>
                <FontAwesomeIcon
                  icon={faClock}
                  className='text-orange-600'
                  size='lg'
                />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs font-bold text-gray-500 uppercase'>
                  Active Government
                </p>
                <p className='text-3xl font-black text-green-600 mt-2'>
                  {stats.activeGovernment}
                </p>
              </div>
              <div className='bg-green-100 w-12 h-12 rounded-full flex items-center justify-center'>
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className='text-green-600'
                  size='lg'
                />
              </div>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200 mb-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-lg font-black text-[#3a4a5b] flex items-center gap-2'>
              <FontAwesomeIcon icon={faBell} className='text-blue-600' />
              Emergency Event Feed
            </h2>
            <span className='text-xs font-bold text-gray-500 uppercase'>
              SOS and location activity
            </span>
          </div>

          {emergencyFeedLoading ? (
            <div className='text-center py-6'>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className='text-gray-400'
                size='lg'
              />
            </div>
          ) : recentFeedEvents.length === 0 ? (
            <p className='text-sm text-gray-500'>No emergency events yet.</p>
          ) : (
            <div className='space-y-3'>
              {activeFeedEvents.length > 0 && (
                <>
                  <p className='text-[10px] font-black text-red-600 uppercase tracking-wide'>
                    Active
                  </p>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {activeFeedEvents.map((event) => renderFeedCard(event))}
                  </div>
                </>
              )}

              {resolvedFeedEvents.length > 0 && (
                <details className='border border-gray-200 rounded-lg bg-gray-50/50'>
                  <summary className='px-3 py-2 text-[10px] font-black text-gray-500 uppercase tracking-wide cursor-pointer select-none'>
                    Resolved ({resolvedFeedEvents.length})
                  </summary>
                  <div className='p-3 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {resolvedFeedEvents.map((event) => renderFeedCard(event))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200 mb-6'>
          <h2 className='text-lg font-black text-[#3a4a5b] mb-4'>
            Quick Actions
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <button
              onClick={this.scrollToPendingAccounts}
              className='p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left'
            >
              <FontAwesomeIcon
                icon={faUserShield}
                className='text-blue-600 mb-2'
                size='lg'
              />
              <p className='text-sm font-bold text-gray-700'>
                Approve Accounts
              </p>
              <p className='text-xs text-gray-500 mt-1'>
                Review pending government registrations
              </p>
            </button>

            <button
              onClick={() => this.setActiveView("users")}
              className='p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left'
            >
              <FontAwesomeIcon
                icon={faUsers}
                className='text-purple-600 mb-2'
                size='lg'
              />
              <p className='text-sm font-bold text-gray-700'>Manage Users</p>
              <p className='text-xs text-gray-500 mt-1'>
                View and manage all user accounts
              </p>
            </button>

            <button
              onClick={() => this.setActiveView("analytics")}
              className='p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left'
            >
              <FontAwesomeIcon
                icon={faChartLine}
                className='text-green-600 mb-2'
                size='lg'
              />
              <p className='text-sm font-bold text-gray-700'>View Analytics</p>
              <p className='text-xs text-gray-500 mt-1'>
                System usage and statistics
              </p>
            </button>

            <button
              onClick={() => this.setActiveView("settings")}
              className='p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all text-left'
            >
              <FontAwesomeIcon
                icon={faShieldHeart}
                className='text-red-600 mb-2'
                size='lg'
              />
              <p className='text-sm font-bold text-gray-700'>System Settings</p>
              <p className='text-xs text-gray-500 mt-1'>
                Configure system parameters
              </p>
            </button>
          </div>
        </div>

        {/* Pending Government Accounts */}
        <div
          ref={this.pendingAccountsRef}
          className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'
        >
          <h2 className='text-lg font-black text-[#3a4a5b] mb-4'>
            Pending Government Accounts
          </h2>

          {loading ? (
            <div className='text-center py-8'>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className='text-gray-400'
                size='2x'
              />
              <p className='text-sm text-gray-500 mt-3'>Loading accounts...</p>
            </div>
          ) : error ? (
            <div className='text-center py-8'>
              <p className='text-sm text-red-600 mb-4'>{error}</p>
              <button
                onClick={this.loadDashboardData}
                className='bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm'
              >
                Retry
              </button>
            </div>
          ) : pendingAccounts.length === 0 ? (
            <p className='text-sm text-gray-500 text-center py-8'>
              No pending government accounts at this time.
            </p>
          ) : (
            <div className='space-y-4'>
              {pendingAccounts.map((account) => (
                <div
                  key={account.id}
                  className='border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <h3 className='font-bold text-[#3a4a5b] text-base'>
                        {account.agencyName}
                      </h3>
                      <p className='text-sm text-gray-600 mt-1'>
                        <span className='font-semibold'>Type:</span>{" "}
                        {account.agencyType}
                      </p>
                      <p className='text-sm text-gray-600'>
                        <span className='font-semibold'>Email:</span>{" "}
                        {account.email}
                      </p>
                      <p className='text-sm text-gray-600'>
                        <span className='font-semibold'>Contact:</span>{" "}
                        {account.contactNumber}
                      </p>
                      <p className='text-xs text-gray-400 mt-2'>
                        Registered:{" "}
                        {account.createdAt?.toDate
                          ? new Date(
                              account.createdAt.toDate(),
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>

                    <div className='flex gap-2 ml-4'>
                      <button
                        onClick={() => this.handleApprove(account.id)}
                        disabled={processingAccountId === account.id}
                        className='bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
                      >
                        {processingAccountId === account.id ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                          <FontAwesomeIcon icon={faCheckCircle} />
                        )}
                        Approve
                      </button>

                      <button
                        onClick={() => this.handleReject(account.id)}
                        disabled={processingAccountId === account.id}
                        className='bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
                      >
                        {processingAccountId === account.id ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                          <FontAwesomeIcon icon={faTimesCircle} />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  /**
   * Render users management view
   * @private
   */
  renderUsersView() {
    const {
      filteredUsers,
      loading,
      error,
      searchTerm,
      filterRole,
      updatingUserStatusId,
    } = this.state;

    return (
      <>
        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-lg font-black text-[#3a4a5b]'>
              User Management
            </h2>
            <button
              onClick={() => this.setActiveView("dashboard")}
              className='text-sm text-gray-600 hover:text-red-600 flex items-center gap-2'
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Back to Dashboard
            </button>
          </div>

          {/* Search and Filter */}
          <div className='flex flex-col md:flex-row gap-4 mb-6'>
            <div className='flex-1 relative'>
              <FontAwesomeIcon
                icon={faSearch}
                className='absolute left-3 top-3 text-gray-400'
              />
              <input
                type='text'
                placeholder='Search by name, email, or agency...'
                value={searchTerm}
                onChange={this.handleSearch}
                className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>
            <div className='relative'>
              <FontAwesomeIcon
                icon={faFilter}
                className='absolute left-3 top-3 text-gray-400'
              />
              <select
                value={filterRole}
                onChange={this.handleFilterChange}
                className='pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              >
                <option value='all'>All Roles</option>
                <option value='resident'>Residents</option>
                <option value='government'>Government</option>
                <option value='admin'>Admins</option>
              </select>
            </div>
          </div>

          {/* Users List */}
          {loading ? (
            <div className='text-center py-8'>
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className='text-gray-400'
                size='2x'
              />
              <p className='text-sm text-gray-500 mt-3'>Loading users...</p>
            </div>
          ) : error ? (
            <div className='text-center py-8'>
              <p className='text-sm text-red-600 mb-4'>{error}</p>
              <button
                onClick={this.loadAllUsers}
                className='bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm'
              >
                Retry
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className='text-sm text-gray-500 text-center py-8'>
              No users found.
            </p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-gray-200'>
                    <th className='text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase'>
                      Name/Agency
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase'>
                      Email
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase'>
                      Role
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase'>
                      Status
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase'>
                      Joined
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-bold text-gray-600 uppercase'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className='border-b border-gray-100 hover:bg-gray-50'
                    >
                      <td className='py-3 px-4'>
                        <p className='text-sm font-semibold text-gray-800'>
                          {this.getUserDisplayName(user)}
                        </p>
                        {user.accountType && (
                          <p className='text-xs text-gray-500'>
                            {user.accountType}
                          </p>
                        )}
                      </td>
                      <td className='py-3 px-4 text-sm text-gray-600'>
                        {user.email}
                      </td>
                      <td className='py-3 px-4'>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-red-100 text-red-700"
                              : user.role === "government"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className='py-3 px-4'>
                        {user.status ? (
                          <span
                            className={`inline-flex items-center justify-center min-w-20 px-3 py-1 rounded-full text-xs font-semibold ${
                              this.getDisplayStatus(user) === "active"
                                ? "bg-green-100 text-green-700"
                                : this.getDisplayStatus(user) === "pending"
                                  ? "bg-orange-100 text-orange-700"
                                  : this.getDisplayStatus(user) === "inactive"
                                    ? "bg-gray-200 text-gray-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                          >
                            {this.getDisplayStatus(user)}
                          </span>
                        ) : (
                          <span className='inline-flex items-center justify-center min-w-20 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700'>
                            active
                          </span>
                        )}
                      </td>
                      <td className='py-3 px-4 text-sm text-gray-600'>
                        {user.createdAt?.toDate
                          ? new Date(
                              user.createdAt.toDate(),
                            ).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className='py-3 px-4'>
                        {user.role === "government" ? (
                          <div className='flex items-center gap-2 flex-wrap'>
                            <button
                              type='button'
                              onClick={() =>
                                this.handleGovernmentStatusChange(user.id, "active")
                              }
                              disabled={
                                updatingUserStatusId === user.id ||
                                this.getDisplayStatus(user) === "active"
                              }
                              className='inline-flex items-center justify-center min-w-24 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              Set Active
                            </button>
                            <button
                              type='button'
                              onClick={() =>
                                this.handleGovernmentStatusChange(user.id, "inactive")
                              }
                              disabled={
                                updatingUserStatusId === user.id ||
                                this.getDisplayStatus(user) === "inactive"
                              }
                              className='inline-flex items-center justify-center min-w-24 px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              Set Inactive
                            </button>
                          </div>
                        ) : user.role === "resident" ? (
                          <div className='flex items-center gap-2 flex-wrap'>
                            <button
                              type='button'
                              onClick={() =>
                                this.handleGovernmentStatusChange(user.id, "active")
                              }
                              disabled={
                                updatingUserStatusId === user.id ||
                                this.getDisplayStatus(user) === "active"
                              }
                              className='inline-flex items-center justify-center min-w-24 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              Set Active
                            </button>
                            <button
                              type='button'
                              onClick={() =>
                                this.handleGovernmentStatusChange(user.id, "inactive")
                              }
                              disabled={
                                updatingUserStatusId === user.id ||
                                this.getDisplayStatus(user) === "inactive"
                              }
                              className='inline-flex items-center justify-center min-w-24 px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              Set Inactive
                            </button>
                          </div>
                        ) : (
                          <span className='text-xs text-gray-400'>N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className='mt-4 text-sm text-gray-500'>
            Showing {filteredUsers.length} user(s)
          </div>
        </div>
      </>
    );
  }

  /**
   * Render analytics view
   * @private
   */
  renderAnalyticsView() {
    const {
      stats,
      allUsers,
      analyticsEmergencyEvents,
      responseResponders,
      responseTeams,
      responseDeployments,
      evacuationCenters,
    } = this.state;

    const residentCount = allUsers.filter((u) => u.role === "resident").length;
    const governmentCount = allUsers.filter(
      (u) => u.role === "government",
    ).length;
    const adminCount = allUsers.filter((u) => u.role === "admin").length;
    const individualCount = allUsers.filter(
      (u) => u.accountType === "individual",
    ).length;
    const familyCount = allUsers.filter(
      (u) => u.accountType === "residential-family",
    ).length;
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const recentRegistrations = allUsers.filter((user) => {
      const createdAt = getDateValue(user.createdAt);
      return createdAt && createdAt >= sevenDaysAgo;
    }).length;
    const monthlyRegistrations = allUsers.filter((user) => {
      const createdAt = getDateValue(user.createdAt);
      return createdAt && createdAt >= thirtyDaysAgo;
    }).length;
    const sosCount = analyticsEmergencyEvents.filter(
      (event) => event.type === "sos",
    ).length;
    const announcementCount = analyticsEmergencyEvents.filter(
      (event) => event.type === "announcement",
    ).length;
    const resolvedIncidentCount = analyticsEmergencyEvents.filter(
      (event) => event.type === "resolution" || event.status === "resolved",
    ).length;
    const activeIncidentCount = analyticsEmergencyEvents.filter(
      (event) =>
        event.type !== "resolution" &&
        event.status !== "resolved" &&
        event.status !== "stopped",
    ).length;
    const activeDeployments = responseDeployments.filter(
      (deployment) => deployment.status !== "Resolved",
    ).length;
    const resolvedDeployments = responseDeployments.filter(
      (deployment) => deployment.status === "Resolved",
    ).length;
    const totalCapacity = evacuationCenters.reduce(
      (sum, center) => sum + (Number(center.capacity) || 0),
      0,
    );
    const totalHeadcount = evacuationCenters.reduce(
      (sum, center) =>
        sum + (Number(center.headcount ?? center.current ?? 0) || 0),
      0,
    );
    const availableSlots = Math.max(totalCapacity - totalHeadcount, 0);
    const occupancyRate =
      totalCapacity > 0 ? Math.round((totalHeadcount / totalCapacity) * 100) : 0;

    return (
      <>
        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-lg font-black text-[#3a4a5b]'>
              System Analytics
            </h2>
            <button
              onClick={() => this.setActiveView("dashboard")}
              className='text-sm text-gray-600 hover:text-red-600 flex items-center gap-2'
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Back to Dashboard
            </button>
          </div>

          {/* Role Distribution */}
          <div className='mb-8'>
            <h3 className='text-md font-bold text-gray-700 mb-4'>
              User Distribution by Role
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='bg-blue-50 rounded-lg p-4 border border-blue-200'>
                <p className='text-xs font-bold text-blue-600 uppercase mb-2'>
                  Residents
                </p>
                <p className='text-3xl font-black text-blue-700'>
                  {residentCount}
                </p>
                <p className='text-xs text-blue-600 mt-1'>
                  {formatShare(residentCount, stats.totalUsers)}
                  % of total
                </p>
              </div>

              <div className='bg-purple-50 rounded-lg p-4 border border-purple-200'>
                <p className='text-xs font-bold text-purple-600 uppercase mb-2'>
                  Government
                </p>
                <p className='text-3xl font-black text-purple-700'>
                  {governmentCount}
                </p>
                <p className='text-xs text-purple-600 mt-1'>
                  {formatShare(governmentCount, stats.totalUsers)}
                  % of total
                </p>
              </div>

              <div className='bg-red-50 rounded-lg p-4 border border-red-200'>
                <p className='text-xs font-bold text-red-600 uppercase mb-2'>
                  Admins
                </p>
                <p className='text-3xl font-black text-red-700'>{adminCount}</p>
                <p className='text-xs text-red-600 mt-1'>
                  {formatShare(adminCount, stats.totalUsers)}
                  % of total
                </p>
              </div>
            </div>

            <div className='mb-8'>
              <h3 className='text-md font-bold text-gray-700 mb-4'>
                Registration Activity
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='bg-slate-50 rounded-lg p-4 border border-slate-200'>
                  <p className='text-xs font-bold text-slate-600 uppercase mb-2'>
                    Last 7 Days
                  </p>
                  <p className='text-3xl font-black text-slate-700'>
                    {recentRegistrations}
                  </p>
                </div>

                <div className='bg-indigo-50 rounded-lg p-4 border border-indigo-200'>
                  <p className='text-xs font-bold text-indigo-600 uppercase mb-2'>
                    Last 30 Days
                  </p>
                  <p className='text-3xl font-black text-indigo-700'>
                    {monthlyRegistrations}
                  </p>
                </div>

                <div className='bg-cyan-50 rounded-lg p-4 border border-cyan-200'>
                  <p className='text-xs font-bold text-cyan-600 uppercase mb-2'>
                    Total Profiles
                  </p>
                  <p className='text-3xl font-black text-cyan-700'>
                    {stats.totalUsers}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Account Types */}
          <div className='mb-8'>
            <h3 className='text-md font-bold text-gray-700 mb-4'>
              Resident Account Types
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='bg-green-50 rounded-lg p-4 border border-green-200'>
                <p className='text-xs font-bold text-green-600 uppercase mb-2'>
                  Individual Accounts
                </p>
                <p className='text-3xl font-black text-green-700'>
                  {individualCount}
                </p>
              </div>

              <div className='bg-teal-50 rounded-lg p-4 border border-teal-200'>
                <p className='text-xs font-bold text-teal-600 uppercase mb-2'>
                  Family Accounts
                </p>
                <p className='text-3xl font-black text-teal-700'>
                  {familyCount}
                </p>
              </div>
            </div>
          </div>

          {/* Government Status */}
          <div className='mb-8'>
            <h3 className='text-md font-bold text-gray-700 mb-4'>
              Government Account Status
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='bg-green-50 rounded-lg p-4 border border-green-200'>
                <div className='flex items-center gap-2 mb-2'>
                  <FontAwesomeIcon
                    icon={faUserCheck}
                    className='text-green-600'
                  />
                  <p className='text-xs font-bold text-green-600 uppercase'>
                    Active
                  </p>
                </div>
                <p className='text-3xl font-black text-green-700'>
                  {stats.activeGovernment}
                </p>
              </div>

              <div className='bg-orange-50 rounded-lg p-4 border border-orange-200'>
                <div className='flex items-center gap-2 mb-2'>
                  <FontAwesomeIcon icon={faClock} className='text-orange-600' />
                  <p className='text-xs font-bold text-orange-600 uppercase'>
                    Pending
                  </p>
                </div>
                <p className='text-3xl font-black text-orange-700'>
                  {stats.pendingApprovals}
                </p>
              </div>

              <div className='bg-red-50 rounded-lg p-4 border border-red-200'>
                <div className='flex items-center gap-2 mb-2'>
                  <FontAwesomeIcon icon={faBan} className='text-red-600' />
                  <p className='text-xs font-bold text-red-600 uppercase'>
                    Inactive / Rejected
                  </p>
                </div>
                <p className='text-3xl font-black text-red-700'>
                  {governmentCount -
                    stats.activeGovernment -
                    stats.pendingApprovals}
                </p>
              </div>
            </div>
          </div>

          <div className='mb-8'>
            <h3 className='text-md font-bold text-gray-700 mb-4'>
              Emergency Activity
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
              <div className='bg-red-50 rounded-lg p-4 border border-red-200'>
                <p className='text-xs font-bold text-red-600 uppercase mb-2'>
                  SOS Alerts
                </p>
                <p className='text-3xl font-black text-red-700'>{sosCount}</p>
              </div>

              <div className='bg-blue-50 rounded-lg p-4 border border-blue-200'>
                <p className='text-xs font-bold text-blue-600 uppercase mb-2'>
                  Announcements
                </p>
                <p className='text-3xl font-black text-blue-700'>
                  {announcementCount}
                </p>
              </div>

              <div className='bg-amber-50 rounded-lg p-4 border border-amber-200'>
                <p className='text-xs font-bold text-amber-600 uppercase mb-2'>
                  Active Incidents
                </p>
                <p className='text-3xl font-black text-amber-700'>
                  {activeIncidentCount}
                </p>
              </div>

              <div className='bg-emerald-50 rounded-lg p-4 border border-emerald-200'>
                <p className='text-xs font-bold text-emerald-600 uppercase mb-2'>
                  Resolved Updates
                </p>
                <p className='text-3xl font-black text-emerald-700'>
                  {resolvedIncidentCount}
                </p>
              </div>
            </div>
          </div>

          <div className='mb-8'>
            <h3 className='text-md font-bold text-gray-700 mb-4'>
              Response Operations
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
              <div className='bg-violet-50 rounded-lg p-4 border border-violet-200'>
                <p className='text-xs font-bold text-violet-600 uppercase mb-2'>
                  Responders
                </p>
                <p className='text-3xl font-black text-violet-700'>
                  {responseResponders.length}
                </p>
              </div>

              <div className='bg-fuchsia-50 rounded-lg p-4 border border-fuchsia-200'>
                <p className='text-xs font-bold text-fuchsia-600 uppercase mb-2'>
                  Teams
                </p>
                <p className='text-3xl font-black text-fuchsia-700'>
                  {responseTeams.length}
                </p>
              </div>

              <div className='bg-orange-50 rounded-lg p-4 border border-orange-200'>
                <p className='text-xs font-bold text-orange-600 uppercase mb-2'>
                  Active Deployments
                </p>
                <p className='text-3xl font-black text-orange-700'>
                  {activeDeployments}
                </p>
              </div>

              <div className='bg-lime-50 rounded-lg p-4 border border-lime-200'>
                <p className='text-xs font-bold text-lime-600 uppercase mb-2'>
                  Resolved Deployments
                </p>
                <p className='text-3xl font-black text-lime-700'>
                  {resolvedDeployments}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className='text-md font-bold text-gray-700 mb-4'>
              Evacuation Center Capacity
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
              <div className='bg-sky-50 rounded-lg p-4 border border-sky-200'>
                <p className='text-xs font-bold text-sky-600 uppercase mb-2'>
                  Centers Tracked
                </p>
                <p className='text-3xl font-black text-sky-700'>
                  {evacuationCenters.length}
                </p>
              </div>

              <div className='bg-teal-50 rounded-lg p-4 border border-teal-200'>
                <p className='text-xs font-bold text-teal-600 uppercase mb-2'>
                  Total Capacity
                </p>
                <p className='text-3xl font-black text-teal-700'>
                  {totalCapacity}
                </p>
              </div>

              <div className='bg-rose-50 rounded-lg p-4 border border-rose-200'>
                <p className='text-xs font-bold text-rose-600 uppercase mb-2'>
                  Current Headcount
                </p>
                <p className='text-3xl font-black text-rose-700'>
                  {totalHeadcount}
                </p>
              </div>

              <div className='bg-emerald-50 rounded-lg p-4 border border-emerald-200'>
                <p className='text-xs font-bold text-emerald-600 uppercase mb-2'>
                  Occupancy / Available
                </p>
                <p className='text-3xl font-black text-emerald-700'>
                  {occupancyRate}%
                </p>
                <p className='text-xs text-emerald-700 mt-1'>
                  {availableSlots} slots available
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /**
   * Render settings view
   * @private
   */
  renderSettingsView() {
    return (
      <>
        <div className='bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-lg font-black text-[#3a4a5b]'>
              System Settings
            </h2>
            <button
              onClick={() => this.setActiveView("dashboard")}
              className='text-sm text-gray-600 hover:text-red-600 flex items-center gap-2'
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Back to Dashboard
            </button>
          </div>

          <div className='space-y-6'>
            {/* Admin Information */}
            <div className='border-b border-gray-200 pb-6'>
              <h3 className='text-md font-bold text-gray-700 mb-4'>
                Admin Information
              </h3>
              <div className='space-y-3'>
                <div>
                  <label className='text-xs font-bold text-gray-500 uppercase'>
                    Admin Name
                  </label>
                  <p className='text-sm text-gray-800 mt-1'>
                    {this.state.adminName}
                  </p>
                </div>
                <div>
                  <label className='text-xs font-bold text-gray-500 uppercase'>
                    Admin ID
                  </label>
                  <p className='text-sm text-gray-800 mt-1 font-mono break-all'>
                    {this.state.adminId || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* System Information */}
            <div className='border-b border-gray-200 pb-6'>
              <h3 className='text-md font-bold text-gray-700 mb-4'>
                System Information
              </h3>
              <div className='space-y-3'>
                <div>
                  <label className='text-xs font-bold text-gray-500 uppercase'>
                    Application
                  </label>
                  <p className='text-sm text-gray-800 mt-1'>
                    Redline Readiness
                  </p>
                </div>
                <div>
                  <label className='text-xs font-bold text-gray-500 uppercase'>
                    Version
                  </label>
                  <p className='text-sm text-gray-800 mt-1'>1.0.0</p>
                </div>
                <div>
                  <label className='text-xs font-bold text-gray-500 uppercase'>
                    Environment
                  </label>
                  <p className='text-sm text-gray-800 mt-1'>Production</p>
                </div>
              </div>
            </div>

            {/* Firebase Configuration Status */}
            <div>
              <h3 className='text-md font-bold text-gray-700 mb-4'>
                Firebase Configuration
              </h3>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-gray-700'>Authentication</span>
                  <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700'>
                    <FontAwesomeIcon icon={faCheckCircle} className='mr-1' />
                    Connected
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-gray-700'>
                    Firestore Database
                  </span>
                  <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700'>
                    <FontAwesomeIcon icon={faCheckCircle} className='mr-1' />
                    Connected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  renderHeaderTabItem(icon, label, viewKey, active = false) {
    return (
      <button
        type='button'
        key={viewKey}
        onClick={() => this.setActiveView(viewKey)}
        className={`flex items-center gap-2 px-5 py-3 min-h-11 text-xs font-bold uppercase rounded-full transition-all whitespace-nowrap ${
          active ? "text-red-700" : "text-slate-500 hover:text-red-700"
        }`}
      >
        <FontAwesomeIcon
          icon={icon}
          className={active ? "text-red-700" : "text-gray-400"}
        />
        <span>{label}</span>
      </button>
    );
  }

  render() {
    const { adminName, activeView, accessibilitySettings, showAdminProfileMenu } = this.state;
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
                  faUserShield,
                  "Dashboard",
                  "dashboard",
                  activeView === "dashboard",
                )}
                {this.renderHeaderTabItem(
                  faUsers,
                  "Users",
                  "users",
                  activeView === "users",
                )}
                {this.renderHeaderTabItem(
                  faChartLine,
                  "Analytics",
                  "analytics",
                  activeView === "analytics",
                )}
                {this.renderHeaderTabItem(
                  faShieldHeart,
                  "Settings",
                  "settings",
                  activeView === "settings",
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
                onClick={this.handleAdminProfileMenuToggle}
              >
                <div className='bg-red-100 w-8 h-8 rounded-full flex items-center justify-center text-red-700 border border-red-200'>
                  <FontAwesomeIcon icon={faUserShield} size='lg' />
                </div>
                <div className='text-left'>
                  <p className='text-[9px] font-bold text-gray-400 uppercase leading-none mb-1'>
                    System Administrator
                  </p>
                  <p className='text-xs font-black text-[#3a4a5b] leading-none'>
                    {adminName}
                  </p>
                </div>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`text-[10px] text-gray-400 transition-transform ${
                    showAdminProfileMenu ? "rotate-180" : ""
                  }`}
                />
              </div>

              {showAdminProfileMenu && (
                <>
                  <div className='hidden lg:block absolute right-0 top-full mt-2 z-2000 profile-dropdown-expandable'>
                    <div className='w-52 bg-white border border-gray-200 rounded-md shadow-xl py-1 overflow-hidden'>
                      <button
                        onClick={this.handleAdminDropdownLogout}
                        className='w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold transition-colors'
                      >
                        <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
                      </button>
                    </div>
                  </div>

                  <div className='lg:hidden relative mt-2 w-full profile-dropdown-expandable'>
                    <div className='w-full bg-white border border-gray-200 rounded-md shadow-sm py-1 overflow-hidden'>
                      <button
                        onClick={this.handleAdminDropdownLogout}
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
        <div className='p-6'>
          <div className='max-w-7xl mx-auto'>
            {activeView === "dashboard" && (
              <div className='mb-6'>
                <h1 className='text-3xl font-black text-[#3a4a5b]'>
                  Admin Dashboard
                </h1>
                <p className='text-sm text-gray-500 mt-1'>
                  Manage users, approve government accounts, and monitor system
                  activity
                </p>
              </div>
            )}

            {/* Conditional View Rendering */}
            {activeView === "dashboard" && this.renderDashboard()}
            {activeView === "users" && this.renderUsersView()}
            {activeView === "analytics" && this.renderAnalyticsView()}
            {activeView === "settings" && this.renderSettingsView()}
          </div>
        </div>

      </div>
    );
  }
}

export default AdminDashboard;
