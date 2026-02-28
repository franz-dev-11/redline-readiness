import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWheelchair,
  faUser,
  faBuildingColumns,
  faArrowLeft,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

const LoginSelection = ({
  residentAuthMode,
  onSelectResident,
  onSelectGov,
  onBack,
}) => {
  const isResidentAuthMode = Boolean(residentAuthMode);

  return (
    <div className='min-h-screen bg-[#f1f5f9] flex flex-col font-sans selection:bg-red-100'>
      {/* Background Decor - Optional aesthetic elements */}
      <div className='absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#3a4a5b]/10 to-transparent -z-10' />

      <main className='grow flex flex-col items-center justify-center px-6 py-12'>
        {/* Back Navigation */}
        {isResidentAuthMode && (
          <button
            type='button'
            onClick={onBack}
            className='mb-8 flex items-center gap-2 text-slate-500 hover:text-red-600 transition-all font-bold tracking-wide uppercase text-sm group'
          >
            <FontAwesomeIcon
              icon={faArrowLeft}
              className='group-hover:-translate-x-1 transition-transform'
            />
            Back to Selection
          </button>
        )}

        {/* Title Section */}
        <div className='text-center max-w-2xl mb-16'>
          <h2 className='text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tighter mb-4'>
            {isResidentAuthMode ? "Access Profile" : "Redline Readiness Portal"}
          </h2>
          <div className='h-1.5 w-24 bg-red-600 mx-auto rounded-full mb-6' />
          <p className='text-slate-500 text-xl font-medium'>
            {isResidentAuthMode
              ? "Choose your account type to manage your safety data."
              : "Select your portal to begin your preparedness journey."}
          </p>
        </div>

        {/* Selection Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl'>
          {/* Card: Resident / Individual */}
          <button
            onClick={() => onSelectResident?.()}
            className='group relative bg-white/70 backdrop-blur-lg border border-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-12 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)] active:scale-95 overflow-hidden cursor-pointer'
          >
            <div className='absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/5 rounded-full' />

            <div className='flex flex-col items-center relative z-10'>
              <div className='w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-200 group-hover:rotate-6  transition-transform'>
                <FontAwesomeIcon
                  icon={isResidentAuthMode ? faUser : faWheelchair}
                  className='text-white text-4xl'
                />
              </div>
              <h3 className='text-2xl font-extrabold text-slate-800 mb-3 tracking-tight'>
                {isResidentAuthMode ? "Individual" : "Resident / PWD"}
              </h3>
              <p className='text-slate-500 text-center leading-relaxed font-medium'>
                {isResidentAuthMode
                  ? "Manage your personal information and emergency settings."
                  : "Dedicated tools for PWDs, caregivers, and household members."}
              </p>
            </div>
          </button>

          {/* Card: Government / Family */}
          <button
            onClick={() => onSelectGov?.()}
            className='group relative bg-white/70 backdrop-blur-lg border border-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-12 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)] active:scale-95 overflow-hidden cursor-pointer'
          >
            <div className='absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-slate-500/5 rounded-full' />

            <div className='flex flex-col items-center relative z-10'>
              <div className='w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-slate-200 group-hover:-rotate-6 transition-transform'>
                <FontAwesomeIcon
                  icon={isResidentAuthMode ? faUsers : faBuildingColumns}
                  className='text-white text-4xl'
                />
              </div>
              <h3 className='text-2xl font-extrabold text-slate-800 mb-3 tracking-tight'>
                {isResidentAuthMode ? "Family" : "Government"}
              </h3>
              <p className='text-slate-500 text-center leading-relaxed font-medium'>
                {isResidentAuthMode
                  ? "Coordinate readiness for your entire family under one login."
                  : "Administrative portal for LGUs and response coordination."}
              </p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default LoginSelection;
