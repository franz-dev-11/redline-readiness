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
} from "@fortawesome/free-solid-svg-icons";

import logo from "../assets/logo.png";

class ResidentDashboardHeader extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isMobileMenuOpen: false,
    };

    this.toggleMobileMenu = this.toggleMobileMenu.bind(this);
    this.closeMobileMenu = this.closeMobileMenu.bind(this);
  }

  toggleMobileMenu() {
    this.setState((prevState) => ({
      isMobileMenuOpen: !prevState.isMobileMenuOpen,
    }));
  }

  closeMobileMenu() {
    this.setState({ isMobileMenuOpen: false });
  }

  renderProfileMenu(isMobile = false) {
    const { menuContent, showProfileMenu } = this.props;

    if (!menuContent || !showProfileMenu) {
      return null;
    }

    const transitionClass = isMobile
      ? "origin-top pointer-events-auto hamburger-menu-expandable"
      : "origin-top pointer-events-auto profile-dropdown-expandable";

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
      onProfileMenuClick,
      activeTab,
    } = this.props;
    const { isMobileMenuOpen } = this.state;

    const renderProfileSection = (isMobile = false) => (
      <div className='relative shrink-0'>
        <div
          className='flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 pr-3 rounded-full transition-colors'
          onClick={onProfileMenuClick}
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
              showProfileMenu ? "rotate-180" : ""
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
            {this.renderTabItem(
              faHouse,
              "Dashboard",
              "dashboard",
              activeTab === "dashboard",
            )}
            {this.renderTabItem(
              faBell,
              "Alerts",
              "alerts",
              activeTab === "alerts",
            )}
            {this.renderTabItem(
              faMapLocationDot,
              "Evac Plan",
              "evac-plan",
              activeTab === "evac-plan",
            )}
            {this.renderTabItem(
              faBookOpen,
              "Resources",
              "resources",
              activeTab === "resources",
            )}
            {this.renderTabItem(
              faAddressBook,
              "Contacts",
              "contacts",
              activeTab === "contacts",
            )}
            {this.renderTabItem(
              faUsersViewfinder,
              "Sectors",
              "sectors",
              activeTab === "sectors",
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

            <div className='hidden lg:block'>{renderProfileSection(false)}</div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <nav className='lg:hidden mt-3 pt-3 border-t border-gray-200 flex flex-col items-stretch gap-2 px-6 pb-3'>
            <div className='border-b border-gray-200 pb-3 mb-1'>
              <p className='px-1 pb-2 text-[11px] font-bold uppercase text-gray-500'>
                Profile
              </p>
              {renderProfileSection(true)}
            </div>

            {this.renderTabItem(
              faHouse,
              "Dashboard",
              "dashboard",
              activeTab === "dashboard",
            )}
            {this.renderTabItem(
              faBell,
              "Alerts",
              "alerts",
              activeTab === "alerts",
            )}
            {this.renderTabItem(
              faMapLocationDot,
              "Evac Plan",
              "evac-plan",
              activeTab === "evac-plan",
            )}
            {this.renderTabItem(
              faBookOpen,
              "Resources",
              "resources",
              activeTab === "resources",
            )}
            {this.renderTabItem(
              faAddressBook,
              "Contacts",
              "contacts",
              activeTab === "contacts",
            )}
            {this.renderTabItem(
              faUsersViewfinder,
              "Sectors",
              "sectors",
              activeTab === "sectors",
            )}
          </nav>
        )}
      </header>
    );
  }
}

export default ResidentDashboardHeader;
