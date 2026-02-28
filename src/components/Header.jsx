import React from "react";

import logo from "../assets/logo.png";

/**
 * Header - Reusable application header component
 * OOP: Stateless presentational component
 * Used across ResidentHome and SetupProfile pages
 */
class Header extends React.Component {
  render() {
    const {
      title = "Redline Readiness",
      subtitle = null,
      children = null,
      sticky = false,
    } = this.props;

    const stickyClasses = sticky ? "sticky top-0 z-[2000]" : "";

    return (
      <header
        className={`bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between shadow-sm ${stickyClasses}`}
      >
        {/* Left side: Logo and branding */}
        <div className='flex items-center gap-2'>
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

        {/* Right side: Custom content (like profile menu) */}
        {children && <div className='relative'>{children}</div>}
      </header>
    );
  }
}

export default Header;
