import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faBell,
  faMapLocationDot,
  faBookOpen,
  faAddressBook,
  faUsersViewfinder,
  faChevronDown,
  faUserCircle,
  faPenToSquare,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

import logo from "../assets/logo.png";

class ResidentDashboardHeader extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isMobileMenuOpen: false,
      isProfileMenuOpen: false,
    };

    this.toggleMobileMenu = this.toggleMobileMenu.bind(this);
    this.closeMobileMenu = this.closeMobileMenu.bind(this);
    this.toggleProfileMenu = this.toggleProfileMenu.bind(this);
    this.handleProfileMenuClick = this.handleProfileMenuClick.bind(this);
  }

  toggleMobileMenu() {
    this.setState((prevState) => ({
      isMobileMenuOpen: !prevState.isMobileMenuOpen,
    }));
  }

  closeMobileMenu() {
    this.setState({ isMobileMenuOpen: false, isProfileMenuOpen: false });
  }

  toggleProfileMenu() {
    this.setState((prevState) => ({
      isProfileMenuOpen: !prevState.isProfileMenuOpen,
    }));
  }

  handleProfileMenuClick() {
    const { onProfileMenuClick } = this.props;

    if (typeof onProfileMenuClick === "function") {
      onProfileMenuClick();
      return;
    }

    this.toggleProfileMenu();
  }

  isProfileMenuVisible() {
    const { showProfileMenu } = this.props;
    if (typeof showProfileMenu === "boolean") {
      return showProfileMenu;
    }

    return this.state.isProfileMenuOpen;
  }

  renderProfileMenu(isMobile = false) {
    const {
      menuContent,
      profileMenuActiveItem,
      onViewProfile,
      onOpenSetup,
      onLogout,
    } = this.props;

    if (!this.isProfileMenuVisible()) {
      return null;
    }

    const transitionClass = isMobile
      ? "origin-top pointer-events-auto hamburger-menu-expandable"
      : "origin-top pointer-events-auto profile-dropdown-expandable";

    if (menuContent) {
      if (!React.isValidElement(menuContent)) {
        return <div className={transitionClass}>{menuContent}</div>;
      }

      const existingClassName = menuContent.props.className || "";
      const positionClass = isMobile
        ? "relative !right-auto !left-auto !mt-2 !w-full"
        : "absolute right-0 top-full mt-2";

      return React.cloneElement(menuContent, {
        className: `${existingClassName} ${positionClass} ${transitionClass}`,
      });
    }

    const positionClass = isMobile
      ? "relative !right-auto !left-auto !mt-2 !w-full"
      : "absolute right-0 top-full mt-2 w-56";

    const setupActive = profileMenuActiveItem === "setup-profile";
    const viewActive = profileMenuActiveItem === "view-profile";

    return (
      <div
        className={`${positionClass} ${transitionClass} bg-white border border-gray-200 rounded-md shadow-xl py-1 z-2001 overflow-hidden`}
      >
        <button
          type='button'
          onClick={onViewProfile}
          className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 font-bold transition-colors ${
            viewActive
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-gray-50"
          }`}
        >
          <FontAwesomeIcon icon={faUserCircle} /> View Profile
        </button>
        <button
          type='button'
          onClick={onOpenSetup}
          className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 font-bold transition-colors ${
            setupActive
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-gray-50"
          }`}
        >
          <FontAwesomeIcon icon={faPenToSquare} /> Setup Profile
        </button>
        {typeof onLogout === "function" && (
          <button
            type='button'
            onClick={onLogout}
            className='w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold transition-colors'
          >
            <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
          </button>
        )}
      </div>
    );
  }

  getNavigationItems() {
    const { navItems } = this.props;
    if (Array.isArray(navItems) && navItems.length > 0) {
      return navItems;
    }

    return [
      { icon: faHouse, label: "Dashboard", key: "dashboard" },
      { icon: faBell, label: "Alerts", key: "alerts" },
      { icon: faMapLocationDot, label: "Evac Plan", key: "evac-plan" },
      { icon: faBookOpen, label: "Resources", key: "resources" },
      { icon: faAddressBook, label: "Contacts", key: "contacts" },
      { icon: faUsersViewfinder, label: "Sectors", key: "sectors" },
    ];
  }

  renderTabItem(icon, label, tabKey, active = false) {
    const { onTabChange } = this.props;
    const { isMobileMenuOpen } = this.state;

    const mobileClass = isMobileMenuOpen
      ? "w-full justify-start rounded-lg px-4 py-3"
      : "";

    return (
      <button
        type='button'
        key={label}
        onClick={() => {
          if (typeof onTabChange === "function") {
            onTabChange(tabKey);
          }
          this.closeMobileMenu();
        }}
        className={`flex items-center gap-2 px-5 py-3 min-h-11 text-xs font-bold uppercase rounded-full transition-all ${mobileClass} ${
          active ? "text-blue-700" : "text-slate-500 hover:text-blue-700"
        }`}
      >
        {icon && (
          <FontAwesomeIcon
            icon={icon}
            className={active ? "text-blue-700" : "text-gray-400"}
          />
        )}
        <span>{label}</span>
      </button>
    );
  }

  render() {
    const {
      userName,
      userPhotoUrl,
      activeTab,
      showProfileSection = true,
    } = this.props;
    const { isMobileMenuOpen } = this.state;
    const navItems = this.getNavigationItems();
    const isProfileMenuOpen = this.isProfileMenuVisible();

    const renderProfileSection = (isMobile = false) => (
      <div className='relative shrink-0'>
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
              isProfileMenuOpen ? "rotate-180" : ""
            }`}
          />
        </div>
        {this.renderProfileMenu(isMobile)}
      </div>
    );

    return (
      <header className='bg-white border-b border-gray-200 shadow-sm sticky top-0 z-2000'>
        <div className='w-full px-6 lg:px-8 py-3 flex items-center gap-4'>
          <div className='flex items-center gap-2 shrink-0'>
            <img
              src={logo}
              alt='Redline Readiness Logo'
              className='w-10 h-10 object-contain'
            />
            <div>
              <h1 className='text-2xl font-bold text-[#3a4a5b] tracking-tight'>
                Redline{" "}
                <span className='font-normal text-gray-500'>Readiness</span>
              </h1>
            </div>
          </div>

          <nav className='hidden lg:flex flex-1 py-1 items-center justify-center gap-2 overflow-x-auto'>
            {navItems.map((item) =>
              this.renderTabItem(
                item.icon,
                item.label,
                item.key,
                activeTab === item.key,
              ),
            )}
          </nav>

          <div className='ml-auto flex items-center gap-2 shrink-0'>
            <button
              type='button'
              onClick={this.toggleMobileMenu}
              className='lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-slate-600 hover:bg-gray-100 transition-colors'
              aria-label='Toggle navigation menu'
              aria-expanded={isMobileMenuOpen}
            >
              <span className='text-base font-black'>
                {isMobileMenuOpen ? "✕" : "☰"}
              </span>
            </button>

            {showProfileSection && (
              <div className='hidden lg:block'>
                {renderProfileSection(false)}
              </div>
            )}
          </div>
        </div>

        {isMobileMenuOpen && (
          <nav className='lg:hidden mt-3 pt-3 border-t border-gray-200 flex flex-col items-stretch gap-2 px-6 pb-3'>
            {showProfileSection && (
              <div className='border-b border-gray-200 pb-3 mb-1'>
                <p className='px-1 pb-2 text-[11px] font-bold uppercase text-gray-500'>
                  Profile
                </p>
                {renderProfileSection(true)}
              </div>
            )}

            {navItems.map((item) =>
              this.renderTabItem(
                item.icon,
                item.label,
                item.key,
                activeTab === item.key,
              ),
            )}
          </nav>
        )}
      </header>
    );
  }
}

export default ResidentDashboardHeader;
