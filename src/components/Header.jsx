import React from "react";

import logo from "../assets/logo.png";

/**
 * Header - Reusable application header component
 * OOP: Class-based presentational component with responsive nav toggle
 * Used across ResidentHome and SetupProfile pages
 */
class Header extends React.Component {
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

  renderMobileCenterContent(centerContent) {
    const mobileItems = React.Children.toArray(centerContent);

    return mobileItems.map((item, index) => {
      if (!React.isValidElement(item)) {
        return <div key={`mobile-nav-${index}`}>{item}</div>;
      }

      const existingClassName = item.props.className || "";
      return React.cloneElement(item, {
        key: item.key ?? `mobile-nav-${index}`,
        className: `${existingClassName} w-full justify-start rounded-lg px-4 py-3`,
      });
    });
  }

  renderMobileProfileContent(profileContent) {
    if (!profileContent) return null;

    if (!React.isValidElement(profileContent)) {
      return <div>{profileContent}</div>;
    }

    const existingClassName = profileContent.props.className || "";
    return React.cloneElement(profileContent, {
      className: `${existingClassName} w-full`,
    });
  }

  render() {
    const {
      title = "Redline Readiness",
      subtitle = null,
      children = null,
      centerContent = null,
      rightContent = null,
      sticky = false,
    } = this.props;
    const { isMobileMenuOpen } = this.state;
    const profileContent = rightContent || children;

    const stickyClasses = sticky ? "sticky top-0 z-[2000]" : "";

    return (
      <header
        className={`bg-white border-b border-gray-200 px-6 lg:px-8 py-3 shadow-sm ${stickyClasses}`}
      >
        <div className='w-full flex items-center gap-4'>
          {/* Left side: Logo and branding */}
          <div className='flex items-center gap-2 shrink-0'>
            <img
              src={logo}
              alt='Redline Readiness Logo'
              className='w-10 h-10 object-contain'
            />
            <div>
              <h1 className='text-2xl font-bold text-[#3a4a5b] tracking-tight'>
                {title.split(" ").map((word, idx) => (
                  <span key={idx}>
                    {idx === 1 ? (
                      <span className='font-normal text-gray-500'>{word}</span>
                    ) : (
                      word
                    )}{" "}
                  </span>
                ))}
              </h1>
              {subtitle && (
                <div className='text-xs text-gray-500'>{subtitle}</div>
              )}
            </div>
          </div>

          {centerContent && (
            <nav className='hidden lg:flex flex-1 py-1 items-center justify-center gap-2 overflow-x-auto'>
              {centerContent}
            </nav>
          )}

          <div className='ml-auto flex items-center gap-2 shrink-0'>
            {centerContent && (
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
            )}

            {profileContent && (
              <div className={`relative shrink-0${centerContent ? ' hidden lg:block' : ''}`}>
                {profileContent}
              </div>
            )}
          </div>
        </div>

        {centerContent && isMobileMenuOpen && (
          <nav
            className='lg:hidden mt-3 pt-3 border-t border-gray-200 flex flex-col items-stretch gap-2 hamburger-menu-expandable'
            onClick={this.closeMobileMenu}
          >
            {profileContent && (
              <div className='border-b border-gray-200 pb-3 mb-1'>
                <p className='px-1 pb-2 text-[11px] font-bold uppercase text-gray-500'>
                  Profile
                </p>
                {this.renderMobileProfileContent(profileContent)}
              </div>
            )}
            {this.renderMobileCenterContent(centerContent)}
          </nav>
        )}
      </header>
    );
  }
}

export default Header;
