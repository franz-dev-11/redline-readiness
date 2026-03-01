import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhoneVolume, faHospital, faShieldHeart } from "@fortawesome/free-solid-svg-icons";

class ResidentContacts extends React.Component {
  renderContact(label, number, icon) {
    return (
      <div className='border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <div className='w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700'>
            <FontAwesomeIcon icon={icon} />
          </div>
          <div>
            <p className='text-sm font-black text-slate-800'>{label}</p>
            <p className='text-xs text-slate-500'>Emergency line</p>
          </div>
        </div>
        <p className='text-sm font-black text-slate-700'>{number}</p>
      </div>
    );
  }

  render() {
    return (
      <section className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
        <h2 className='text-xl font-black text-slate-800 uppercase tracking-tight'>
          Contacts
        </h2>
        <p className='text-sm text-slate-600 mt-1'>
          Sample emergency contact directory for residents.
        </p>

        <div className='mt-5 space-y-3'>
          {this.renderContact("Municipal DRRMO", "+63 44 812 3400", faShieldHeart)}
          {this.renderContact("Local Rescue Team", "+63 44 811 2299", faPhoneVolume)}
          {this.renderContact("Municipal Hospital", "+63 44 812 1188", faHospital)}
        </div>
      </section>
    );
  }
}

export default ResidentContacts;
