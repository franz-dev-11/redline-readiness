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
  faBell,
  faMapLocationDot,
  faBookOpen,
  faAddressBook,
  faShieldHeart,
  faWheelchair,
  faUserGroup,
  faMagnifyingGlass,
  faChevronDown,
  faUserCircle,
  faRightFromBracket,
  faLocationCrosshairs,
  faTriangleExclamation,
  faRoute,
  faCircleCheck,
  faClock,
} from "@fortawesome/free-solid-svg-icons";

// Firebase imports
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

// Component imports
import Header from "../../components/Header";

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
 * ResidentHome - OOP Class-based Component
 * Main dashboard for residents with map integration
 */
class ResidentHome extends React.Component {
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
      searchQuery: "",
      mapCenter: ORIGINAL_CENTER,
      recenterSignal: 0,
      currentTime: new Date(),
      lastUpdatedAt: new Date(),
      isMarkedSafe: false,
      safeMarkedAt: null,
      // profileQrCode removed
    };

    // Bind methods
    this.handleSearch = this.handleSearch.bind(this);
    this.handleProfileMenuClick = this.handleProfileMenuClick.bind(this);
    this.handleReturnToOrigin = this.handleReturnToOrigin.bind(this);
    this.handleEvacCardClick = this.handleEvacCardClick.bind(this);
    this.fetchUserData = this.fetchUserData.bind(this);
    this.handleMarkSafe = this.handleMarkSafe.bind(this);
    this.getLastUpdatedLabel = this.getLastUpdatedLabel.bind(this);
    this.getDirectionsUrl = this.getDirectionsUrl.bind(this);
  }

  /**
   * Component lifecycle - fetch user data on mount
   */
  componentDidMount() {
    this.fetchUserData();
    this.lastUpdatedTimer = setInterval(() => {
      this.setState({ currentTime: new Date() });
    }, 60000);
  }

  componentWillUnmount() {
    if (this.lastUpdatedTimer) {
      clearInterval(this.lastUpdatedTimer);
    }
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

  handleMarkSafe() {
    this.setState({
      isMarkedSafe: true,
      safeMarkedAt: new Date(),
    });
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

  getDirectionsUrl(position) {
    const [lat, lng] = position;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }

  /**
   * Render TabItem sub-component
   * @private
   */
  renderTabItem(icon, label, active = false) {
    return (
      <div
        key={label}
        className={`flex items-center gap-2 px-5 py-3 min-h-11 text-xs font-bold uppercase cursor-pointer rounded-full transition-all ${
          active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-200"
        }`}
      >
        <FontAwesomeIcon
          icon={icon}
          className={active ? "text-white" : "text-gray-400"}
        />
        <span>{label}</span>
      </div>
    );
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
      searchQuery,
      mapCenter,
      recenterSignal,
      isMarkedSafe,
      safeMarkedAt,
    } = this.state;
    const centers = ResidentHome.EVACUATION_CENTERS;
    const totalCapacity = centers.reduce((sum, center) => {
      const [occupied, total] = center.capacity
        .replace("Capacity", "")
        .split("/")
        .map((value) => Number(value.trim()));
      return sum + (Number.isFinite(total) ? total : 0);
    }, 0);
    const totalOccupied = centers.reduce((sum, center) => {
      const [occupied] = center.capacity
        .replace("Capacity", "")
        .split("/")
        .map((value) => Number(value.trim()));
      return sum + (Number.isFinite(occupied) ? occupied : 0);
    }, 0);
    const highRiskCenters = centers.filter((center) => center.isFull).length;
    const selectedCenter =
      centers.find(
        (center) =>
          center.position[0] === mapCenter[0] && center.position[1] === mapCenter[1],
      ) || centers[0];
    const lastUpdatedLabel = this.getLastUpdatedLabel();

    return (
      <div className='min-h-screen bg-slate-100 font-sans text-slate-700'>
        {/* Header Component */}
        <Header sticky={true}>
          <div
            className='flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 pr-3 rounded-full transition-colors'
            onClick={this.handleProfileMenuClick}
          >
            <div className='w-8 h-8 rounded-full flex items-center justify-center border border-blue-200 overflow-hidden'>
              {userPhotoUrl ? (
                <img
                  src={userPhotoUrl}
                  alt='Profile'
                  className='w-full h-full object-cover'
                />
              ) : (
                <div className='bg-blue-100 w-full h-full flex items-center justify-center text-blue-700'>
                  <FontAwesomeIcon icon={faUserCircle} size='lg' />
                </div>
              )}
            </div>
            <div className='hidden md:block text-left'>
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
          </div>
          {showProfileMenu && (
            <div className='absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-xl py-1 z-[2001] overflow-hidden'>
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
                <FontAwesomeIcon icon={faUserCircle} /> Setup Profile
              </button>
              <div className='px-4 py-3 border-b border-gray-100 bg-gray-50/50'>
                <p className='text-xs font-bold truncate text-[#3a4a5b]'>
                  {auth.currentUser?.email}
                </p>
              </div>
              <button
                onClick={this.props.onLogout}
                className='w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold transition-colors'
              >
                <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
              </button>
            </div>
          )}
        </Header>

        <div className='max-w-7xl mx-auto px-4 py-5 space-y-5'>
          <section className='bg-white border border-slate-200 rounded-2xl p-5 shadow-sm'>
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
              <div>
                <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
                  Resident Command View
                </p>
                <h1 className='text-2xl md:text-3xl font-black text-slate-800 mt-1'>
                  Welcome back, {userName.split(" ")[0] || "Resident"}
                </h1>
                <p className='text-sm text-slate-600 mt-1 font-medium'>
                  Monitor center capacity and access evacuation plans in one
                  view.
                </p>

                <div className='mt-4'>
                  <button
                    type='button'
                    onClick={this.handleMarkSafe}
                    disabled={isMarkedSafe}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                      isMarkedSafe
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    <FontAwesomeIcon icon={faCircleCheck} />
                    {isMarkedSafe ? "Marked Safe" : "Mark myself as safe"}
                  </button>
                  {isMarkedSafe && safeMarkedAt && (
                    <p className='text-xs font-semibold text-emerald-700 mt-2'>
                      Status shared at {safeMarkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>

              <div className='grid grid-cols-3 gap-3 w-full md:w-auto'>
                <div className='bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 min-w-28'>
                  <p className='text-[10px] uppercase font-bold text-blue-500'>
                    Centers
                  </p>
                  <p className='text-xl font-black text-blue-700'>
                    {centers.length}
                  </p>
                </div>
                <div className='bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 min-w-28'>
                  <p className='text-[10px] uppercase font-bold text-emerald-500'>
                    Occupied
                  </p>
                  <p className='text-xl font-black text-emerald-700'>
                    {totalOccupied}/{totalCapacity}
                  </p>
                </div>
                <div
                  className={`rounded-xl px-4 py-3 min-w-28 transition-all ${
                    highRiskCenters > 0
                      ? "bg-red-50 border-2 border-red-400 shadow-md animate-pulse scale-[1.04]"
                      : "bg-red-50 border border-red-100"
                  }`}
                >
                  <p className='text-[10px] uppercase font-bold text-red-500'>
                    High Risk
                  </p>
                  <p
                    className={`font-black text-red-700 ${
                      highRiskCenters > 0
                        ? "text-2xl"
                        : "text-xl"
                    }`}
                  >
                    {highRiskCenters}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <nav className='bg-white border border-slate-200 rounded-2xl px-3 py-2 flex items-center gap-2 overflow-x-auto shadow-sm'>
            {this.renderTabItem(faHouse, "Dashboard", true)}
            {this.renderTabItem(faBell, "Alerts")}
            {this.renderTabItem(faMapLocationDot, "Evac Plan")}
            {this.renderTabItem(faBookOpen, "Resources")}
            {this.renderTabItem(faAddressBook, "Contacts")}
          </nav>

          <main className='grid grid-cols-1 lg:grid-cols-12 gap-5'>
            {/* MAIN MAP SECTION */}
            <section className='lg:col-span-8'>
              <div className='bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm'>
                <div className='px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between'>
                  <h2 className='text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-tight'>
                    <FontAwesomeIcon icon={faHouse} className='text-blue-700' />{" "}
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
                    <FontAwesomeIcon icon={faClock} className='text-slate-500' />
                    Last updated: {lastUpdatedLabel}
                  </p>

                  <div className='relative h-[560px] w-full border border-slate-200 rounded-2xl overflow-hidden z-0 mt-4'>
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
                          icon={createCenterMarkerIcon(center.isFull, false)}
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
                              <b className='text-blue-700'>{center.name}</b>
                              <br />
                              {center.capacity}
                              <div className='text-[10px] font-black text-red-600'>
                                {center.percent >= 90 ? "Near Capacity" : "Available"}
                              </div>
                              <a
                                href={this.getDirectionsUrl(center.position)}
                                target='_blank'
                                rel='noreferrer'
                                className='inline-flex items-center gap-1 text-[10px] text-blue-700 font-black'
                              >
                                <FontAwesomeIcon icon={faRoute} /> Get Directions
                              </a>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>

                    {/* SEARCH & RETURN CONTROLS */}
                    <div className='absolute top-4 left-4 right-4 z-[501] flex items-center gap-2 px-1'>
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
                    <div className='absolute top-16 left-4 w-72 bg-white/95 shadow-lg border border-slate-200 rounded-2xl p-5 z-[500] backdrop-blur-sm'>
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
                              Go to nearest center or contact a response team if
                              you need assistance.
                            </p>
                          </div>
                          <a
                            href={this.getDirectionsUrl(selectedCenter.position)}
                            target='_blank'
                            rel='noreferrer'
                            className='inline-flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase'
                          >
                            <FontAwesomeIcon icon={faRoute} /> Get Directions
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* EMERGENCY CONTACTS OVERLAY */}
                    <div className='absolute bottom-4 left-4 w-72 bg-white/95 shadow-lg border border-slate-200 rounded-2xl p-4 z-[500]'>
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
                      <button className='w-full mt-3 bg-red-600 text-white font-black py-2 rounded-xl text-xs hover:bg-red-700 uppercase tracking-widest transition-all'>
                        Call Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SIDEBAR SECTION */}
            <section className='lg:col-span-4 space-y-4'>
              <h3 className='text-xs font-black text-slate-500 uppercase tracking-[0.18em]'>
                Recommended Sites
              </h3>
              <div className='h-44 w-full border border-slate-200 rounded-2xl relative overflow-hidden shadow-sm z-0 bg-white'>
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
                <div className='absolute top-2 right-2 z-[500]'>
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
        </div>
      </div>
    );
  }
}

export default ResidentHome;
