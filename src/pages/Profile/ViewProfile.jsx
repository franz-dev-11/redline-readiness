import React from "react";
import { QRCodeSVG } from "qrcode.react";
import ResidentDashboardHeader from "../../components/ResidentDashboardHeader";
import AuthService from "../../services/AuthService";
import { auth } from "../../firebase";
import ViewFamilyProfile from "./ViewFamilyProfile";

/**
 * ViewProfile - OOP Class-based Component
 * Displays saved resident profile from Firebase
 */
class ViewProfile extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      error: "",
      profile: null,
    };

    this.loadProfile = this.loadProfile.bind(this);
  }

  componentDidMount() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user found.");
      }

      const profile = await AuthService.getUserData(user.uid);
      this.setState({ profile, loading: false, error: "" });
    } catch (error) {
      this.setState({
        loading: false,
        error: error.message || "Failed to load profile.",
      });
    }
  }

  render() {
    const { loading, error, profile } = this.state;
    const headerUserName =
      profile?.personalInfo?.fullName || profile?.fullName || "Resident";

    if (loading) {
      return (
        <div className='min-h-screen bg-[#f3f4f6]'>
          <ResidentDashboardHeader
            userName={headerUserName}
            activeTab=''
            profileMenuActiveItem='view-profile'
            onLogout={this.props.onLogout}
            onTabChange={(tabKey) => {
              if (typeof this.props.onNavigateTab === "function") {
                this.props.onNavigateTab(tabKey);
              }
            }}
          />
          <div className='max-w-5xl mx-auto p-6'>
            <div className='bg-white border rounded p-6 text-sm text-gray-500'>
              Loading profile...
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className='min-h-screen bg-[#f3f4f6]'>
          <ResidentDashboardHeader
            userName={headerUserName}
            activeTab=''
            profileMenuActiveItem='view-profile'
            onLogout={this.props.onLogout}
            onTabChange={(tabKey) => {
              if (typeof this.props.onNavigateTab === "function") {
                this.props.onNavigateTab(tabKey);
              }
            }}
          />
          <div className='max-w-5xl mx-auto p-6'>
            <div className='bg-white border rounded p-6'>
              <div className='text-red-600 text-sm font-bold mb-4'>{error}</div>
              <button
                type='button'
                onClick={this.props.onBack}
                className='px-4 py-2 bg-slate-600 text-white rounded text-sm font-bold'
              >
                Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    const personal = profile?.personalInfo || {};
    const family = profile?.familyProfile || {};
    const isFamilyProfile =
      profile?.accountType === "residential-family" ||
      family?.profileMode === "family";

    if (isFamilyProfile) {
      return (
        <ViewFamilyProfile
          profile={profile}
          onBack={this.props.onBack}
          onLogout={this.props.onLogout}
          onNavigateTab={this.props.onNavigateTab}
        />
      );
    }

    const displayName = isFamilyProfile
      ? family.householdName ||
        family.householdHead ||
        profile?.fullName ||
        "Family Profile"
      : personal.fullName || profile?.fullName || "Resident Profile";
    const photoUrl = personal.photoUrl || profile?.photoUrl || "";
    const contactValue = personal.contact || profile?.phone || "—";
    const addressValue = personal.address || "—";
    const selectedDisabilities =
      profile?.selectedDisabilities ||
      Object.keys(profile?.disabilities || {}).filter(
        (key) => profile.disabilities[key],
      );

    return (
      <div className='min-h-screen bg-[#f3f4f6]'>
        <ResidentDashboardHeader
          userName={headerUserName}
          activeTab=''
          profileMenuActiveItem='view-profile'
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

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                <>
                  <div>
                    <p className='text-gray-500 text-xs font-bold'>
                      Date of Birth
                    </p>
                    <p className='font-bold text-slate-700'>
                      {personal.dob || "—"}
                    </p>
                  </div>
                  <div>
                    <p className='text-gray-500 text-xs font-bold'>Gender</p>
                    <p className='font-bold text-slate-700'>
                      {personal.gender || "—"}
                    </p>
                  </div>
                  <div>
                    <p className='text-gray-500 text-xs font-bold'>Contact</p>
                    <p className='font-bold text-slate-700'>{contactValue}</p>
                  </div>
                  <div>
                    <p className='text-gray-500 text-xs font-bold'>
                      Blood Type
                    </p>
                    <p className='font-bold text-slate-700'>
                      {personal.bloodType || "—"}
                    </p>
                  </div>
                </>
                <div className='md:col-span-2'>
                  <p className='text-gray-500 text-xs font-bold'>Address</p>
                  <p className='font-bold text-slate-700'>{addressValue}</p>
                </div>
              </div>

              <div className='mt-6 p-4 bg-blue-50 border border-blue-100 rounded'>
                <p className='text-xs font-bold text-blue-900 mb-2'>
                  Disabilities
                </p>
                {selectedDisabilities.length > 0 ? (
                  <div className='flex flex-wrap gap-2'>
                    {selectedDisabilities.map((item) => (
                      <span
                        key={item}
                        className='px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold'
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className='text-sm text-slate-600'>
                    No disabilities reported
                  </p>
                )}
                {profile?.disabilityNotes && (
                  <p className='mt-3 text-xs text-slate-700'>
                    <span className='font-bold'>Notes:</span>{" "}
                    {profile.disabilityNotes}
                  </p>
                )}
              </div>
            </div>

            {/* QR Code Card */}
            <div className='lg:col-span-4'>
              <div className='bg-white border rounded p-5'>
                <p className='text-xs font-black text-slate-700 mb-4 uppercase tracking-wide'>Your Profile QR Code</p>
                {profile?.profileQrCode ? (
                  <>
                    <div className='flex justify-center mb-3'>
                      <div id='profile-qr-wrapper' className='p-3 bg-white border border-gray-200 rounded-lg inline-block'>
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
                          const wrapper = document.getElementById('profile-qr-wrapper');
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

export default ViewProfile;
