import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRightFromBracket,
  faArrowLeft,
  faSearch,
  faUpload,
  faUsers,
  faShieldHeart,
  faMapMarkedAlt,
  faClipboardList,
  faChartBar,
  faUserShield,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Header from "../../components/Header";
import AuthService from "../../services/AuthService";

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

      // Registered Users
      registeredUsers: [],
      filteredUsers: [],
      searchTerm: "",
      filterStatus: "all",

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
  }

  /**
   * Load dashboard data on mount
   */
  async componentDidMount() {
    const unsubscribe = AuthService.onAuthStateChange(async (user) => {
      if (user) {
        await this.loadDashboardData();
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
      });

      // Load registered residents
      const { collection, query, where, getDocs } =
        await import("firebase/firestore");
      const usersRef = collection(AuthService.db, "users");
      const q = query(usersRef, where("role", "==", "resident"));
      const querySnapshot = await getDocs(q);

      const users = [];
      let pwdCount = 0;
      let familyCount = 0;

      querySnapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        users.push(userData);

        if (userData.pwdId && userData.pwdId !== "N/A") {
          pwdCount++;
        }
        if (userData.accountType === "residential-family") {
          familyCount++;
        }
      });

      this.setState({
        stats: {
          totalRegistered: users.length,
          pwdCount,
          familyCount,
        },
        registeredUsers: users,
        filteredUsers: users,
        loading: false,
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
    const { stats, evacuationCenters, filteredUsers, searchTerm, loading } =
      this.state;

    return (
      <>
        {/* Search and Stats Bar */}
        <div className='bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='flex-1 relative max-w-md'>
              <FontAwesomeIcon
                icon={faSearch}
                className='absolute left-3 top-3 text-gray-400'
              />
              <input
                type='text'
                placeholder='Search user...'
                value={searchTerm}
                onChange={this.handleSearch}
                className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>
            <div className='flex items-center gap-6 ml-6'>
              <div className='flex items-center gap-2'>
                <FontAwesomeIcon icon={faUsers} className='text-blue-600' />
                <span className='text-sm font-bold text-gray-700'>
                  {stats.totalRegistered}{" "}
                  <span className='text-gray-500 font-normal'>Individual</span>
                </span>
              </div>

              <div className='flex items-center gap-2'>
                <FontAwesomeIcon icon={faUsers} className='text-green-600' />
                <span className='text-sm font-bold text-gray-700'>
                  {stats.familyCount}{" "}
                  <span className='text-gray-500 font-normal'>Families</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Left Panel - Evacuation Centers */}
          <div className='lg:col-span-1 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-black text-[#3a4a5b]'>
                Evacuation Center Capacity
              </h3>
              <button className='text-blue-600 hover:text-blue-700'>
                <FontAwesomeIcon icon={faUpload} />
              </button>
            </div>
            <p className='text-xs text-gray-500 mb-6'>
              Upload files to help your LGU respond effectively
            </p>

            <div className='space-y-4'>
              {evacuationCenters.map((center) => {
                const percentage = (center.current / center.capacity) * 100;
                return (
                  <div
                    key={center.id}
                    className='border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors'
                  >
                    <div className='flex items-center gap-3 mb-2'>
                      <div className='bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center'>
                        <FontAwesomeIcon
                          icon={faShieldHeart}
                          className='text-blue-600 text-sm'
                        />
                      </div>
                      <div className='flex-1'>
                        <h4 className='font-bold text-sm text-[#3a4a5b]'>
                          {center.name}
                        </h4>
                        <p className='text-xs text-gray-500'>
                          {center.location}
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='font-bold text-sm text-[#3a4a5b]'>
                          {center.current}/{center.capacity}
                        </p>
                        <p className='text-xs text-gray-500'>Capacity</p>
                      </div>
                    </div>
                    <div className='w-full bg-gray-200 rounded-full h-2'>
                      <div
                        className={`${this.getCapacityColor(
                          center.current,
                          center.capacity,
                        )} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <p className='text-xs text-gray-500 mt-1'>
                      {center.current} / {center.capacity} weekly
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center Panel - Map */}
          <div className='lg:col-span-1 bg-white rounded-lg shadow-sm p-6 border border-gray-200'>
            <h3 className='text-lg font-black text-[#3a4a5b] mb-4'>
              Evacuation Center Map
            </h3>
            <div className='rounded-lg h-96 overflow-hidden border-2 border-gray-200'>
              <MapContainer
                center={this.state.mapCenter}
                zoom={this.state.mapZoom}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                />

                {/* Add markers for each evacuation center */}
                {evacuationCenters.map((center) => {
                  const markerColor = this.getMarkerColor(
                    center.current,
                    center.capacity,
                  );
                  const percentage = (
                    (center.current / center.capacity) *
                    100
                  ).toFixed(0);

                  return (
                    <React.Fragment key={center.id}>
                      {/* Marker */}
                      <Marker
                        position={center.coordinates}
                        icon={this.createMarkerIcon(markerColor)}
                      >
                        <Popup>
                          <div className='p-2 min-w-[200px]'>
                            <h4 className='font-bold text-sm text-gray-800 mb-2'>
                              {center.name}
                            </h4>
                            <p className='text-xs text-gray-600 mb-2'>
                              📍 {center.location}
                            </p>
                            <div className='border-t border-gray-200 pt-2 mt-2'>
                              <div className='flex justify-between items-center mb-1'>
                                <span className='text-xs text-gray-600'>
                                  Capacity:
                                </span>
                                <span className='text-xs font-bold text-gray-800'>
                                  {center.current} / {center.capacity}
                                </span>
                              </div>
                              <div className='w-full bg-gray-200 rounded-full h-2'>
                                <div
                                  className={`${this.getCapacityColor(
                                    center.current,
                                    center.capacity,
                                  )} h-2 rounded-full`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <p className='text-xs text-gray-500 mt-1'>
                                {percentage}% occupied
                              </p>
                            </div>
                            <div className='mt-2 pt-2 border-t border-gray-200'>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                  center.status === "available"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {center.status === "available"
                                  ? "✓ Available"
                                  : "⚠ Near Capacity"}
                              </span>
                            </div>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Radius circle around marker */}
                      <Circle
                        center={center.coordinates}
                        radius={300}
                        pathOptions={{
                          color: markerColor,
                          fillColor: markerColor,
                          fillOpacity: 0.1,
                          weight: 2,
                        }}
                      />
                    </React.Fragment>
                  );
                })}
              </MapContainer>
            </div>

            {/* Registrar's Teams */}
            <div className='mt-6'>
              <h4 className='text-sm font-bold text-[#3a4a5b] mb-3 flex items-center gap-2'>
                <FontAwesomeIcon
                  icon={faUserShield}
                  className='text-blue-600'
                />
                Registrar's Teams
              </h4>
              <div className='space-y-2'>
                {evacuationCenters.map((center) => (
                  <div
                    key={center.id}
                    className='text-xs p-2 bg-gray-50 rounded border border-gray-200'
                  >
                    <p className='font-semibold text-gray-700'>{center.name}</p>
                    <p className='text-gray-500'>
                      {center.current}/{center.capacity} Capacity
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Registered Users */}
          <div className='lg:col-span-1 bg-blue-50 rounded-lg shadow-sm p-6 border border-blue-200'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-black text-[#3a4a5b]'>
                Registered Users
              </h3>
              <div className='flex items-center gap-2'>
                <select
                  onChange={this.handleFilterChange}
                  className='text-xs px-2 py-1 border border-gray-300 rounded bg-white text-black'
                >
                  <option value='all'>All</option>
                  <option value='family'>Families</option>
                  <option value='individual'>Individual</option>
                </select>
              </div>
            </div>

            <div className='space-y-3 max-h-[600px] overflow-y-auto'>
              {loading ? (
                <div className='text-center py-8'>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    className='text-gray-400 text-2xl'
                  />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className='text-sm text-gray-500 text-center py-8'>
                  No registered users found.
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className='bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex-shrink-0'>
                        {user.photo ? (
                          <img
                            src={user.photo}
                            alt={user.fullName}
                            className='w-full h-full object-cover'
                          />
                        ) : (
                          <div className='w-full h-full flex items-center justify-center bg-blue-200 text-blue-700 font-bold text-sm'>
                            {user.fullName?.charAt(0) || "U"}
                          </div>
                        )}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <p className='font-bold text-sm text-[#3a4a5b] truncate'>
                          {user.fullName || "Unknown User"}
                        </p>
                        <div className='flex items-center gap-2 mt-1'>
                          {user.accountType === "residential-family" ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700'>
                              Family
                            </span>
                          ) : (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700'>
                              Individual
                            </span>
                          )}
                          {user.pwdId && user.pwdId !== "N/A" && (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700'>
                              PWD
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
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
    const { activeTab } = this.state;

    if (activeTab === "dashboard") {
      return this.renderDashboard();
    }

    // Placeholder for other tabs
    return (
      <div className='bg-white rounded-lg shadow-sm p-12 border border-gray-200 text-center'>
        <FontAwesomeIcon
          icon={faClipboardList}
          className='text-gray-300 text-6xl mb-4'
        />
        <h3 className='text-xl font-bold text-gray-600 mb-2'>
          {activeTab.replace("-", " ").toUpperCase()}
        </h3>
        <p className='text-gray-500'>This section is under development.</p>
      </div>
    );
  }

  render() {
    const { agencyName, activeTab } = this.state;

    return (
      <div className='min-h-screen bg-[#f3f4f6] font-sans'>
        {/* Header Component */}
        <Header sticky={true}>
          <div className='flex items-center gap-3'>
            <div className='bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center text-blue-700 border border-blue-200'>
              <FontAwesomeIcon icon={faShieldHeart} size='lg' />
            </div>
            <div className='hidden md:block text-left'>
              <p className='text-[9px] font-bold text-gray-400 uppercase leading-none mb-1'>
                Government Account
              </p>
              <p className='text-xs font-black text-[#3a4a5b] leading-none'>
                {agencyName}
              </p>
            </div>
            <button
              onClick={this.handleLogout}
              className='ml-4 text-gray-600 hover:text-red-600 transition-colors'
              title='Logout'
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
          </div>
        </Header>

        {/* Main Content */}
        <div className='p-6'>
          <div className='max-w-7xl mx-auto'>
            {/* Back Button and Title */}
            <div className='mb-6'>
              <h1 className='text-3xl font-black text-[#3a4a5b]'>
                Resident Monitoring
              </h1>
              <p className='text-sm text-gray-500 mt-1'>
                Manage evacuation centers and monitor registered users for
                planning
              </p>
            </div>

            {/* Tab Navigation */}
            <div className='mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-2'>
              <div className='flex gap-2 overflow-x-auto'>
                <button
                  onClick={() => this.setActiveTab("dashboard")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === "dashboard"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FontAwesomeIcon icon={faChartBar} />
                  Dashboard
                </button>
                <button
                  onClick={() => this.setActiveTab("evacuation-plans")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === "evacuation-plans"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FontAwesomeIcon icon={faMapMarkedAlt} />
                  Evacuation Plans
                </button>
                <button
                  onClick={() => this.setActiveTab("response-teams")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === "response-teams"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FontAwesomeIcon icon={faUserShield} />
                  Response Teams
                </button>
                <button
                  onClick={() => this.setActiveTab("registered-users")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === "registered-users"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FontAwesomeIcon icon={faUsers} />
                  Registered Users
                </button>
                <button
                  onClick={() => this.setActiveTab("reports")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === "reports"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <FontAwesomeIcon icon={faClipboardList} />
                  Reports
                </button>
              </div>
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
