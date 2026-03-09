import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import logo from "../../assets/logo.png";
import banner from "../../assets/disaster.jpg";

function GovernmentPendingApproval({ onBack, onContactAdmin }) {
  const handleContactAdmin = () => {
    if (onContactAdmin) {
      onContactAdmin();
      return;
    }

    window.location.href =
      "mailto:fopamorada@gmail.com?subject=Government%20Account%20Approval%20Request&body=Hello%20Administrator%2C%0D%0A%0D%0AMy%20government%20account%20is%20still%20pending%20approval.%20Please%20review%20my%20registration.%0D%0A%0D%0AThank%20you.";
  };

  return (
    <div className='min-h-screen w-full flex items-stretch bg-[#8ea2b3] font-sans relative'>
      <button
        type='button'
        className='absolute top-6 left-6 flex items-center text-gray-600 hover:text-black font-semibold text-base z-10 px-4 py-2 rounded transition-colors'
        onClick={onBack}
      >
        <FontAwesomeIcon icon={faArrowLeft} className='mr-2' />
        Back
      </button>

      <div className='flex flex-col justify-center items-center w-full md:w-1/2 bg-white px-8 py-12'>
        <div className='w-full max-w-sm mx-auto text-center'>
          <div className='flex justify-center mb-8'>
            <img src={logo} alt='Logo' className='h-16' />
          </div>

          <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 text-yellow-600 mb-6'>
            <FontAwesomeIcon icon={faClock} className='text-2xl' />
          </div>

          <h1 className='text-3xl font-black text-[#3a4a5b] mb-3'>
            Account Pending Approval
          </h1>
          <p className='text-gray-600 text-sm leading-relaxed'>
            Your government account is currently pending administrator approval.
            You will be able to access the dashboard once your account is verified.
          </p>

          <button
            type='button'
            onClick={onBack}
            className='mt-8 w-full bg-black text-white font-bold py-3 rounded shadow-lg transition-all active:scale-95 hover:bg-gray-800'
          >
            Back to Government Login
          </button>

          <button
            type='button'
            onClick={handleContactAdmin}
            className='mt-3 w-full border border-black text-black font-bold py-3 rounded transition-all active:scale-95 hover:bg-gray-100'
          >
            Contact Administrator
          </button>
        </div>
      </div>

      <div className='hidden md:block w-1/2 bg-gray-200'>
        <div className='h-full w-full flex items-center justify-center'>
          <img
            src={banner}
            alt='Government Approval Status'
            className='object-cover h-screen w-full '
          />
        </div>
      </div>
    </div>
  );
}

export default GovernmentPendingApproval;