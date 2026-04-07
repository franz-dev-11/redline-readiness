import React from "react";
import { db } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * QrScanPage - Scan a resident's profile QR code and display their
 * profile data and medical documents.
 *
 * Works with any camera (webcam or phone) via html5-qrcode loaded from CDN.
 */
class QrScanPage extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      scanning: false,
      loading: false,
      scannedValue: null,
      resident: null,
      error: null,
    };

    this.html5QrCode = null;
    this.startScanner = this.startScanner.bind(this);
    this.stopScanner = this.stopScanner.bind(this);
    this.handleScan = this.handleScan.bind(this);
    this.handleReset = this.handleReset.bind(this);
  }

  componentDidMount() {
    if (!window.Html5Qrcode) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/html5-qrcode";
      script.onload = () => {
        // ready
      };
      document.body.appendChild(script);
    }
  }

  componentWillUnmount() {
    this.stopScanner();
  }

  startScanner() {
    if (!window.Html5Qrcode) {
      this.setState({ error: "QR scanner library is not loaded yet. Please wait a moment and try again." });
      return;
    }

    this.html5QrCode = new window.Html5Qrcode("qr-scan-region");
    this.setState({ scanning: true, error: null, resident: null, scannedValue: null });

    this.html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          this.html5QrCode.stop().then(() => {
            this.html5QrCode.clear();
            this.setState({ scanning: false });
            this.handleScan(decodedText);
          });
        },
        () => {},
      )
      .catch((err) => {
        this.setState({ scanning: false, error: "Camera error: " + err });
      });
  }

  stopScanner() {
    if (this.html5QrCode) {
      this.html5QrCode.stop().catch(() => {}).finally(() => {
        if (this.html5QrCode) {
          this.html5QrCode.clear();
          this.html5QrCode = null;
        }
        this.setState({ scanning: false });
      });
    }
  }

  async handleScan(value) {
    this.setState({ loading: true, scannedValue: value, error: null });

    try {
      const q = query(
        collection(db, "users"),
        where("profileQrCode", "==", value),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        this.setState({
          loading: false,
          error: "No registered profile found for this QR code.",
        });
        return;
      }

      const resident = snap.docs[0].data();
      this.setState({ loading: false, resident });
    } catch (err) {
      this.setState({ loading: false, error: "Failed to look up QR: " + err.message });
    }
  }

  handleReset() {
    this.setState({
      scanning: false,
      loading: false,
      scannedValue: null,
      resident: null,
      error: null,
    });
  }

  renderScanner() {
    const { scanning, loading } = this.state;

    return (
      <div className='flex flex-col items-center'>
        {/* Camera viewfinder container — always in DOM so html5-qrcode can mount into it */}
        <div
          id='qr-scan-region'
          className='w-full max-w-sm rounded-xl overflow-hidden border-2 border-blue-300 bg-black'
          style={{ minHeight: 280, display: scanning ? "block" : "none" }}
        />

        {!scanning && !loading && (
          <div className='flex flex-col items-center gap-4 py-8'>
            <div className='w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center'>
              <svg className='w-10 h-10 text-blue-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5}
                  d='M12 4v1m0 14v1M4 12h1m14 0h1m-3.05-6.95l-.707.707M6.757 17.243l-.707.707M17.243 17.243l-.707-.707M6.757 6.757l-.707-.707M9 12a3 3 0 116 0 3 3 0 01-6 0z' />
              </svg>
            </div>
            <p className='text-sm text-slate-500 text-center max-w-xs'>
              Point your camera at a Redline Readiness profile QR code to view the resident's emergency information.
            </p>
            <button
              onClick={this.startScanner}
              className='px-6 py-3 bg-blue-700 text-white rounded-xl font-black text-sm hover:bg-blue-800 transition-colors'
            >
              Start Camera
            </button>
          </div>
        )}

        {scanning && (
          <button
            onClick={this.stopScanner}
            className='mt-4 px-5 py-2 bg-gray-500 text-white rounded-lg font-bold text-sm hover:bg-gray-600'
          >
            Cancel
          </button>
        )}

        {loading && (
          <div className='py-8 text-blue-700 font-bold text-sm animate-pulse'>
            Looking up profile…
          </div>
        )}
      </div>
    );
  }

  renderProfile() {
    const { resident, scannedValue } = this.state;

    const isFamilyAccount =
      resident?.accountType === "residential-family" ||
      resident?.familyProfile?.profileMode === "family";

    if (isFamilyAccount) {
      return this.renderFamilyProfile();
    }

    const personal = resident?.personalInfo || {};
    const displayName = personal.fullName || resident?.fullName || "Unknown Resident";
    const photoUrl = personal.photoUrl || resident?.photoUrl || "";

    const selectedDisabilities =
      resident?.selectedDisabilities ||
      Object.keys(resident?.disabilities || {}).filter((k) => resident.disabilities[k]);

    const documents = resident?.uploadedDocuments || [];

    const age = personal.dob
      ? Math.floor((Date.now() - new Date(personal.dob)) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    return (
      <div className='space-y-4'>
        {/* Header card */}
        <div className='bg-white border rounded-xl p-5'>
          <div className='flex items-center gap-1 mb-4'>
            <span className='w-2 h-2 bg-green-500 rounded-full inline-block'></span>
            <span className='text-xs font-bold text-green-700 ml-1'>Profile found</span>
          </div>

          <div className='flex items-start gap-4'>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt='Profile'
                className='w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0'
              />
            ) : (
              <div className='w-20 h-20 rounded-xl border border-gray-200 bg-blue-100 flex items-center justify-center text-2xl font-black text-blue-700 shrink-0'>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className='min-w-0'>
              <h2 className='text-xl font-black text-slate-800 leading-tight'>{displayName}</h2>
              <div className='mt-1 flex flex-wrap gap-2'>
                {personal.gender && (
                  <span className='text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded'>
                    {personal.gender.charAt(0).toUpperCase() + personal.gender.slice(1)}
                  </span>
                )}
                {age !== null && !isNaN(age) && (
                  <span className='text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded'>
                    Age {age}
                  </span>
                )}
                {personal.bloodType && (
                  <span className='text-xs bg-red-100 text-red-700 font-black px-2 py-0.5 rounded'>
                    {personal.bloodType}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
            {personal.dob && (
              <div>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Date of Birth</p>
                <p className='font-bold text-slate-700'>{personal.dob}</p>
              </div>
            )}
            {personal.contact && (
              <div>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Contact</p>
                <p className='font-bold text-slate-700'>{personal.contact}</p>
              </div>
            )}
            {personal.address && (
              <div className='sm:col-span-2'>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Address</p>
                <p className='font-bold text-slate-700'>{personal.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Disabilities */}
        <div className='bg-white border rounded-xl p-5'>
          <p className='text-xs font-black text-slate-700 mb-3 uppercase tracking-wide'>Disabilities</p>
          {selectedDisabilities.length > 0 ? (
            <div className='flex flex-wrap gap-2'>
              {selectedDisabilities.map((d) => (
                <span key={d} className='px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold'>
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <p className='text-sm text-slate-500'>No disabilities reported</p>
          )}
          {resident?.disabilityNotes && (
            <p className='mt-3 text-xs text-slate-600'>
              <span className='font-bold'>Notes:</span> {resident.disabilityNotes}
            </p>
          )}
        </div>

        {/* Medical Documents */}
        <div className='bg-white border rounded-xl p-5'>
          <p className='text-xs font-black text-slate-700 mb-3 uppercase tracking-wide'>Medical Documents</p>
          {documents.length > 0 ? (
            <ul className='space-y-2'>
              {documents.map((doc, i) => (
                <li key={i} className='flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg'>
                  <svg className='w-5 h-5 text-blue-600 mt-0.5 shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
                  </svg>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-slate-700 break-words'>{doc.name}</p>
                    <p className='text-[10px] text-gray-400'>
                      {doc.type || 'Unknown type'}
                      {doc.size ? ` · ${(doc.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-sm text-slate-500'>No documents uploaded</p>
          )}
        </div>

        {/* QR ID */}
        {scannedValue && (
          <div className='text-center text-[10px] text-gray-400 font-bold break-all'>
            QR ID: {scannedValue}
          </div>
        )}

        <button
          onClick={this.handleReset}
          className='w-full py-3 bg-blue-700 text-white rounded-xl font-black text-sm hover:bg-blue-800 transition-colors'
        >
          Scan Another QR
        </button>
      </div>
    );
  }

  renderFamilyProfile() {
    const { resident, scannedValue } = this.state;
    const family = resident?.familyProfile || {};
    const personal = resident?.personalInfo || {};

    const displayName =
      family.householdName || family.householdHead || personal.fullName || "Family Account";
    const photoUrl = personal.photoUrl || resident?.photoUrl || "";

    const headDob = family.householdHeadDateOfBirth || "";
    const headAge = headDob
      ? Math.floor((Date.now() - new Date(headDob)) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const householdMembers = Array.isArray(family.householdMembers) ? family.householdMembers : [];
    const documents = Array.isArray(family.householdHeadMedicalDocuments)
      ? family.householdHeadMedicalDocuments
      : Array.isArray(family.uploadedMedicalDocuments)
        ? family.uploadedMedicalDocuments
        : [];

    const selectedDisabilities =
      resident?.selectedDisabilities ||
      Object.keys(resident?.disabilities || {}).filter((k) => resident.disabilities[k]);

    return (
      <div className='space-y-4'>
        {/* Header card */}
        <div className='bg-white border rounded-xl p-5'>
          <div className='flex items-center gap-1 mb-4'>
            <span className='w-2 h-2 bg-green-500 rounded-full inline-block' />
            <span className='text-xs font-bold text-green-700 ml-1'>Family profile found</span>
          </div>

          <div className='flex items-start gap-4'>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt='Profile'
                className='w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0'
              />
            ) : (
              <div className='w-20 h-20 rounded-xl border border-gray-200 bg-blue-100 flex items-center justify-center text-2xl font-black text-blue-700 shrink-0'>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className='min-w-0'>
              <h2 className='text-xl font-black text-slate-800 leading-tight'>{displayName}</h2>
              <span className='text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded'>
                Family Account
              </span>
            </div>
          </div>

          <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
            {family.householdHead && (
              <div>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Household Head</p>
                <p className='font-bold text-slate-700'>{family.householdHead}</p>
              </div>
            )}
            {headDob && (
              <div>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Head Date of Birth</p>
                <p className='font-bold text-slate-700'>
                  {headDob}{headAge !== null && !isNaN(headAge) ? ` (Age ${headAge})` : ""}
                </p>
              </div>
            )}
            {family.contactNumber && (
              <div>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Contact</p>
                <p className='font-bold text-slate-700'>{family.contactNumber}</p>
              </div>
            )}
            {family.emergencyContactName && (
              <div>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Emergency Contact</p>
                <p className='font-bold text-slate-700'>
                  {family.emergencyContactName}
                  {family.emergencyContactNumber ? ` · ${family.emergencyContactNumber}` : ""}
                </p>
              </div>
            )}
            {family.address && (
              <div className='sm:col-span-2'>
                <p className='text-[10px] font-bold text-gray-400 uppercase'>Address</p>
                <p className='font-bold text-slate-700'>{family.address}</p>
              </div>
            )}
          </div>

          {/* Household counts */}
          <div className='mt-4 flex flex-wrap gap-2'>
            {family.totalMembers > 0 && (
              <span className='text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded'>
                {family.totalMembers} Members
              </span>
            )}
            {family.pwdMembers > 0 && (
              <span className='text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded'>
                {family.pwdMembers} PWD
              </span>
            )}
            {family.elderlyMembers > 0 && (
              <span className='text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded'>
                {family.elderlyMembers} Elderly
              </span>
            )}
            {family.childMembers > 0 && (
              <span className='text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded'>
                {family.childMembers} Children
              </span>
            )}
            {family.pregnantMembers > 0 && (
              <span className='text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded'>
                {family.pregnantMembers} Pregnant
              </span>
            )}
          </div>
        </div>

        {/* Disabilities */}
        {selectedDisabilities.length > 0 && (
          <div className='bg-white border rounded-xl p-5'>
            <p className='text-xs font-black text-slate-700 mb-3 uppercase tracking-wide'>Disabilities</p>
            <div className='flex flex-wrap gap-2'>
              {selectedDisabilities.map((d) => (
                <span key={d} className='px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold'>
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Household Members */}
        {householdMembers.length > 0 && (
          <div className='bg-white border rounded-xl p-5'>
            <p className='text-xs font-black text-slate-700 mb-3 uppercase tracking-wide'>
              Household Members ({householdMembers.length})
            </p>
            <div className='space-y-2'>
              {householdMembers.map((member, i) => (
                <div key={i} className='flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg'>
                  <div className='w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-sm shrink-0'>
                    {(member.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-slate-700'>{member.name || "Unknown"}</p>
                    <p className='text-[11px] text-gray-500'>
                      {[member.relationship, member.disabilityType].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medical Documents */}
        <div className='bg-white border rounded-xl p-5'>
          <p className='text-xs font-black text-slate-700 mb-3 uppercase tracking-wide'>Medical Documents</p>
          {documents.length > 0 ? (
            <ul className='space-y-2'>
              {documents.map((doc, i) => (
                <li key={i} className='flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg'>
                  <svg className='w-5 h-5 text-blue-600 mt-0.5 shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
                  </svg>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-slate-700 break-words'>{doc.name}</p>
                    <p className='text-[10px] text-gray-400'>
                      {doc.type || "Unknown type"}
                      {doc.size ? ` · ${(doc.size / 1024).toFixed(1)} KB` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-sm text-slate-500'>No documents uploaded</p>
          )}
        </div>

        {scannedValue && (
          <div className='text-center text-[10px] text-gray-400 font-bold break-all'>
            QR ID: {scannedValue}
          </div>
        )}

        <button
          onClick={this.handleReset}
          className='w-full py-3 bg-blue-700 text-white rounded-xl font-black text-sm hover:bg-blue-800 transition-colors'
        >
          Scan Another QR
        </button>
      </div>
    );
  }

  render() {
    const { resident, error, scanning, loading } = this.state;

    return (
      <div className='px-4 py-6 max-w-2xl mx-auto'>
        {/* Page heading */}
        <div className='mb-6'>
          <h1 className='text-2xl font-black text-[#3a4a5b]'>Scan Resident QR</h1>
          <p className='text-xs text-slate-400 mt-1'>Emergency profile lookup — scan a resident's profile QR code</p>
        </div>

        {!resident && !loading && (
          <>
            {error && (
              <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-bold flex items-start gap-2'>
                <svg className='w-4 h-4 mt-0.5 shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                </svg>
                {error}
                {!scanning && (
                  <button onClick={this.handleReset} className='ml-auto underline text-xs font-bold text-red-600'>
                    Try again
                  </button>
                )}
              </div>
            )}
            <div className='bg-white border rounded-xl p-6'>
              {this.renderScanner()}
            </div>
          </>
        )}

        {loading && (
          <div className='bg-white border rounded-xl p-10 flex flex-col items-center gap-3'>
            <div className='w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin' />
            <p className='text-sm font-bold text-slate-500'>Looking up profile…</p>
          </div>
        )}

        {resident && this.renderProfile()}
      </div>
    );
  }
}

export default QrScanPage;
