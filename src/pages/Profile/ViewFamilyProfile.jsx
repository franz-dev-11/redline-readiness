import React from "react";
import { QRCodeSVG } from "qrcode.react";
import ResidentDashboardHeader from "../../components/ResidentDashboardHeader";
import ViewManager from "../../services/ViewManager";

class ViewFamilyProfile extends React.Component {
  formatDateValue(rawValue) {
    if (!rawValue) {
      return "—";
    }

    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return String(rawValue);
    }

    return parsedDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  renderMemberDob(member) {
    const rawDob = member?.dateOfBirth || member?.birthDate || member?.dob;
    return this.formatDateValue(rawDob);
  }

  render() {
    const { profile } = this.props;

    const family = profile?.familyProfile || {};
    const personal = profile?.personalInfo || {};
    const displayName =
      family.householdName ||
      family.householdHead ||
      profile?.fullName ||
      "Family Profile";
    const photoUrl = personal.photoUrl || profile?.photoUrl || "";
    const contactValue = family.contactNumber || profile?.phone || "—";
    const addressValue = family.address || "—";
    const householdMembers = Array.isArray(family?.householdMembers)
      ? family.householdMembers
      : [];

    const disabilityLabelMap = {
      visual: "Visual Disability",
      hearing: "Hearing Disability",
      intellectual: "Intellectual Disability",
      physical: "Physical Disability",
      psychological: "Psychological Disability",
      rare: "Rare Disability",
    };

    return (
      <div className='min-h-screen bg-[#f3f4f6]'>
        <ResidentDashboardHeader
          userName={displayName}
          activeTab=''
          profileMenuActiveItem='view-profile'
          onViewProfile={() => ViewManager.goToViewProfile()}
          onOpenSetup={() => ViewManager.goToFamilySetupProfile()}
          onLogout={this.props.onLogout}
          onTabChange={(tabKey) => {
            if (typeof this.props.onNavigateTab === "function") {
              this.props.onNavigateTab(tabKey);
            }
          }}
        />

        <div className='max-w-6xl mx-auto p-6'>
          <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
            <div className='lg:col-span-8 bg-white border rounded p-6'>
              <div className='flex items-center gap-4 mb-4'>
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt='Profile'
                    className='w-20 h-20 rounded-xl object-cover border border-gray-200'
                  />
                ) : (
                  <div className='w-20 h-20 rounded-xl border border-gray-200 bg-blue-100 flex items-center justify-center text-2xl font-black text-blue-700'>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className='text-sm font-bold text-slate-700'></p>
                </div>
              </div>

              <h1 className='text-2xl font-black text-[#3a4a5b] mb-1'>
                {displayName}
              </h1>

              <p className='text-xs text-slate-500 font-semibold mb-4'>
                Family Account Profile
              </p>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                <div>
                  <p className='text-gray-500 text-xs font-bold'>
                    Household Head
                  </p>
                  <p className='font-bold text-slate-700'>
                    {family.householdHead || profile?.fullName || "—"}
                  </p>
                  <p className='text-xs text-slate-500 mt-1'>
                    Date of Birth:{" "}
                    {this.formatDateValue(
                      family.householdHeadDateOfBirth ||
                        family.householdHeadDob,
                    )}
                  </p>
                  <p className='text-xs text-slate-500 mt-1'>
                    Disability:{" "}
                    {disabilityLabelMap[family.householdHeadDisabilityType] ||
                      family.householdHeadDisabilityType ||
                      "None"}
                  </p>
                </div>
                <div>
                  <p className='text-gray-500 text-xs font-bold'>Contact</p>
                  <p className='font-bold text-slate-700'>{contactValue}</p>
                </div>
                <div>
                  <p className='text-gray-500 text-xs font-bold'>
                    Total Members
                  </p>
                  <p className='font-bold text-slate-700'>
                    {family.totalMembers ?? householdMembers.length ?? "—"}
                  </p>
                </div>
                <div>
                  <p className='text-gray-500 text-xs font-bold'>
                    Preferred Evac Center
                  </p>
                  <p className='font-bold text-slate-700'>
                    {family.preferredEvacCenter || "—"}
                  </p>
                </div>
                <div className='md:col-span-2'>
                  <p className='text-gray-500 text-xs font-bold'>Address</p>
                  <p className='font-bold text-slate-700'>{addressValue}</p>
                </div>
              </div>

              <div className='mt-6 p-4 bg-slate-50 border border-slate-200 rounded'>
                <p className='text-xs font-bold text-slate-700 mb-3'>
                  Household Summary
                </p>
                <div className='grid grid-cols-2 md:grid-cols-3 gap-3 text-xs'>
                  <div>
                    <p className='text-slate-500 font-semibold'>PWD</p>
                    <p className='text-slate-800 font-bold'>
                      {family.pwdMembers ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className='text-slate-500 font-semibold'>Elderly</p>
                    <p className='text-slate-800 font-bold'>
                      {family.elderlyMembers ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className='text-slate-500 font-semibold'>Children</p>
                    <p className='text-slate-800 font-bold'>
                      {family.childMembers ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className='text-slate-500 font-semibold'>Pregnant</p>
                    <p className='text-slate-800 font-bold'>
                      {family.pregnantMembers ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className='text-slate-500 font-semibold'>Mobility</p>
                    <p className='text-slate-800 font-bold'>
                      {family.mobilityNeedsCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className='text-slate-500 font-semibold'>Medication</p>
                    <p className='text-slate-800 font-bold'>
                      {family.maintenanceMedicationCount ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className='mt-6 p-4 bg-white border border-gray-200 rounded'>
                <p className='text-xs font-bold text-slate-700 mb-3'>
                  Household Members
                </p>
                {householdMembers.length === 0 ? (
                  <p className='text-sm text-slate-600'>
                    No household members listed.
                  </p>
                ) : (
                  <div className='space-y-2'>
                    {householdMembers.map((member, index) => (
                      <div
                        key={`household-member-${index}`}
                        className='p-3 border border-gray-200 rounded bg-gray-50 text-xs'
                      >
                        <p className='font-bold text-slate-800'>
                          {member?.name || `Member ${index + 1}`}
                        </p>
                        <p className='text-slate-600 mt-1'>
                          Date of Birth: {this.renderMemberDob(member)} •
                          Relationship: {member?.relationship || "—"}
                        </p>
                        <p className='text-slate-600 mt-1'>
                          Disability:{" "}
                          {disabilityLabelMap[member?.disabilityType] ||
                            member?.disabilityType ||
                            "None"}
                        </p>
                        <p className='text-slate-600 mt-1'>
                          Mobility Needs:{" "}
                          {member?.hasMobilityNeeds ? "Yes" : "No"} • Medical
                          Needs: {member?.hasMedicalNeeds ? "Yes" : "No"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {family?.notes && (
                <div className='mt-6 p-4 bg-blue-50 border border-blue-100 rounded'>
                  <p className='text-xs font-bold text-blue-900 mb-2'>
                    Family Notes
                  </p>
                  <p className='text-sm text-slate-700'>{family.notes}</p>
                </div>
              )}
            </div>

            {/* QR Code Card */}
            <div className='lg:col-span-4'>
              <div className='bg-white border rounded p-5'>
                <p className='text-xs font-black text-slate-700 mb-4 uppercase tracking-wide'>Your Profile QR Code</p>
                {profile?.profileQrCode ? (
                  <>
                    <div className='flex justify-center mb-3'>
                      <div id='family-qr-wrapper' className='p-3 bg-white border border-gray-200 rounded-lg inline-block'>
                        <QRCodeSVG
                          value={profile.profileQrCode}
                          size={176}
                          bgColor='#ffffff'
                          fgColor='#1e293b'
                          level='M'
                        />
                      </div>
                    </div>
                    <p className='text-[10px] text-gray-400 text-center font-bold break-all mb-3'>
                      {profile.profileQrCode}
                    </p>
                    <p className='text-[11px] text-slate-500 text-center'>
                      Show this QR to first responders or LGU personnel to quickly access your emergency profile.
                    </p>
                    <div className='mt-4 flex justify-center'>
                      <button
                        onClick={() => {
                          const wrapper = document.getElementById('family-qr-wrapper');
                          const svg = wrapper && wrapper.querySelector('svg');
                          if (!svg) return;
                          const serializer = new XMLSerializer();
                          const svgStr = serializer.serializeToString(svg);
                          const blob = new Blob([svgStr], { type: 'image/svg+xml' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${displayName.replace(/\s+/g, '-')}-QR.svg`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className='px-4 py-2 bg-blue-700 text-white rounded text-xs font-bold hover:bg-blue-800 transition-colors'
                      >
                        Download QR
                      </button>
                    </div>
                  </>
                ) : (
                  <p className='text-xs text-gray-400 text-center py-6'>
                    Complete your profile setup to generate your QR code.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ViewFamilyProfile;
