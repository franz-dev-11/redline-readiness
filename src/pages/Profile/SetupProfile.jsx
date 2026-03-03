import React from "react";
// Dynamically load html5-qrcode only on client
let Html5Qrcode = null;
if (typeof window !== "undefined") {
  Html5Qrcode = window.Html5Qrcode;
}
import ProfileService from "../../services/ProfileService";
import AuthService from "../../services/AuthService";
import { auth } from "../../firebase";
import Header from "../../components/Header";

/**
 * StepPill - Reusable step indicator component
 * OOP: Encapsulated UI subcomponent
 */
class StepPill extends React.Component {
  render() {
    const { label, active } = this.props;

    return (
      <div
        className={`text-[11px] px-3 py-1 rounded-full font-bold ${
          active ? "bg-blue-700 text-white" : "bg-gray-100 text-slate-600"
        }`}
      >
        {label}
      </div>
    );
  }
}

/**
 * SetupProfile - OOP Class-based Component
 * Manages multi-step profile setup wizard
 * Data flow: Component state → handlers → ProfileService
 */
class SetupProfile extends React.Component {
  // Class constants
  STEPS = ["About You", "Disabilities", "Documents", "Finish"];
  DISABILITIES = {
    visual: "Visual Disability",
    hearing: "Hearing Disability",
    intellectual: "Intellectual Disability",
    physical: "Physical Disability",
    psychological: "Psychological Disability",
    rare: "Rare Disability",
  };

  constructor(props) {
    super(props);

    // Initialize component state
    this.state = {
      step: 0,
      fullName: "",
      dob: "",
      gender: "",
      contact: "",
      address: "",
      bloodType: "",
      photo: null,
      photoUrl: "",
      photoPreview: null,
      hasDisability: false,
      disabilities: {
        visual: false,
        hearing: false,
        intellectual: false,
        physical: false,
      },
      disabilityNotes: "",
      files: [],
      profileQrCode: "",
      errors: [],
      isLoading: false,
      // QR Claim State
      qrClaimResult: null, // Will store server response (e.g., user data or claim status)
      qrClaimError: null,
      isClaiming: false,
      showQrScanner: false,
      html5QrCodeInstance: null,
      scanAgain: false,
    };

    // Bind methods
    this.handleNext = this.handleNext.bind(this);
    this.handlePrev = this.handlePrev.bind(this);
    this.handleFinish = this.handleFinish.bind(this);
    this.handleDisabilityToggle = this.handleDisabilityToggle.bind(this);
    this.handleFilesChange = this.handleFilesChange.bind(this);
    this.handleRemoveFile = this.handleRemoveFile.bind(this);
    this.handleHasDisabilityChange = this.handleHasDisabilityChange.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handlePhotoChange = this.handlePhotoChange.bind(this);
    this.handleRemovePhoto = this.handleRemovePhoto.bind(this);
    this.ensureProfileQrCode = this.ensureProfileQrCode.bind(this);
    this.loadExistingProfile = this.loadExistingProfile.bind(this);
    this.renderProfileQrCard = this.renderProfileQrCard.bind(this);
    this.renderQrClaimSection = this.renderQrClaimSection.bind(this);
    this.startQrScanner = this.startQrScanner.bind(this);
    this.stopQrScanner = this.stopQrScanner.bind(this);
    this.handleQrScan = this.handleQrScan.bind(this);
    this.handleScanAgain = this.handleScanAgain.bind(this);
  }

  componentDidMount() {
    this.loadExistingProfile();
    this.ensureProfileQrCode();
    // Load html5-qrcode script if not present
    if (!window.Html5Qrcode) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/html5-qrcode";
      script.onload = () => {
        Html5Qrcode = window.Html5Qrcode;
      };
      document.body.appendChild(script);
    } else {
      Html5Qrcode = window.Html5Qrcode;
    }
  }
  // QR Claim Logic
  startQrScanner() {
    if (!window.Html5Qrcode) {
      this.setState({ qrClaimError: "QR scanner not loaded." });
      return;
    }
    if (this.state.html5QrCodeInstance) {
      this.state.html5QrCodeInstance.clear();
    }
    const qrRegionId = "qr-reader-claim";
    const html5QrCode = new window.Html5Qrcode(qrRegionId);
    this.setState({
      showQrScanner: true,
      qrClaimResult: null,
      qrClaimError: null,
      scanAgain: false,
      html5QrCodeInstance: html5QrCode,
    });
    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 15, qrbox: 250 },
        (decodedText) => {
          html5QrCode.stop();
          this.handleQrScan(decodedText);
        },
        () => {},
      )
      .catch((err) => {
        this.setState({ qrClaimError: "Camera error: " + err });
      });
  }

  stopQrScanner() {
    if (this.state.html5QrCodeInstance) {
      this.state.html5QrCodeInstance.stop().then(() => {
        this.state.html5QrCodeInstance.clear();
        this.setState({ html5QrCodeInstance: null, showQrScanner: false });
      });
    } else {
      this.setState({ showQrScanner: false });
    }
  }

  async handleQrScan(qrCodeMessage) {
    this.setState({
      isClaiming: true,
      qrClaimResult: null,
      qrClaimError: null,
    });
    try {
      // The QR code is used as an ID, not a coupon. Adjust endpoint and logic as needed.
      const response = await fetch("http://localhost:3001/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: qrCodeMessage }),
      });
      const data = await response.json();
      if (response.ok) {
        this.setState({
          qrClaimResult: data, // data could be user info or claim status
          qrClaimError: null,
          scanAgain: true,
        });
      } else {
        this.setState({
          qrClaimError: data.message || "Error processing QR ID.",
          qrClaimResult: null,
          scanAgain: true,
        });
      }
    } catch {
      this.setState({
        qrClaimError: "Network error.",
        qrClaimResult: null,
        scanAgain: true,
      });
    }
    this.setState({ isClaiming: false });
  }

  handleScanAgain() {
    if (this.state.html5QrCodeInstance) {
      this.state.html5QrCodeInstance.clear();
    }
    this.setState(
      { qrClaimResult: null, qrClaimError: null, scanAgain: false },
      this.startQrScanner,
    );
  }
  renderQrClaimSection() {
    const {
      showQrScanner,
      qrClaimResult,
      qrClaimError,
      scanAgain,
      isClaiming,
    } = this.state;
    return (
      <div className='my-8 p-4 bg-blue-50 border border-blue-200 rounded'>
        <h3 className='text-lg font-bold mb-2 text-blue-800'>
          Register Device
        </h3>
        {/* Always render the qr-reader-claim element, but hide it when not scanning */}
        <div
          id='qr-reader-claim'
          style={{
            width: "100%",
            minHeight: 220,
            marginBottom: 12,
            display: showQrScanner ? "block" : "none",
          }}
        ></div>
        {!showQrScanner && !scanAgain && (
          <button
            className='px-4 py-2 bg-blue-700 text-white rounded font-bold text-sm hover:bg-blue-800'
            onClick={this.startQrScanner}
          >
            Scan your QR code
          </button>
        )}
        {showQrScanner && (
          <div>
            <button
              className='mt-2 px-3 py-2 bg-gray-400 text-white rounded font-bold text-xs hover:bg-gray-600'
              onClick={this.stopQrScanner}
            >
              Cancel
            </button>
          </div>
        )}
        {isClaiming && (
          <div className='mt-3 text-blue-700 font-bold'>Processing...</div>
        )}
        {qrClaimResult && (
          <div className='mt-3 p-3 bg-green-100 border border-green-300 rounded text-green-900 font-bold'>
            Success! QR ID found:{" "}
            {qrClaimResult.value
              ? qrClaimResult.value
              : JSON.stringify(qrClaimResult)}
          </div>
        )}
        {qrClaimError && (
          <div className='mt-3 p-3 bg-red-100 border border-red-300 rounded text-red-900 font-bold'>
            {qrClaimError}
          </div>
        )}
        {scanAgain && (
          <button
            className='mt-4 px-4 py-2 bg-blue-700 text-white rounded font-bold text-sm hover:bg-blue-800'
            onClick={this.handleScanAgain}
          >
            Scan Again
          </button>
        )}
      </div>
    );
  }

  async loadExistingProfile() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const existingData = await AuthService.getUserData(user.uid);
      if (!existingData) return;

      const personalInfo = existingData.personalInfo || {};
      const existingPhotoUrl =
        personalInfo.photoUrl || existingData.photoUrl || "";
      const mergedDisabilities = {
        visual: false,
        hearing: false,
        intellectual: false,
        physical: false,
        ...(existingData.disabilities || {}),
      };

      this.setState((prevState) => ({
        fullName:
          personalInfo.fullName || existingData.fullName || prevState.fullName,
        dob: personalInfo.dob || prevState.dob,
        gender: personalInfo.gender || prevState.gender,
        contact:
          personalInfo.contact || existingData.phone || prevState.contact,
        address: personalInfo.address || prevState.address,
        bloodType: personalInfo.bloodType || prevState.bloodType,
        photoUrl: existingPhotoUrl || prevState.photoUrl,
        photoPreview: existingPhotoUrl || prevState.photoPreview,
        hasDisability:
          typeof existingData.hasDisability === "boolean"
            ? existingData.hasDisability
            : Object.values(mergedDisabilities).some(Boolean),
        disabilities: mergedDisabilities,
        disabilityNotes:
          existingData.disabilityNotes || prevState.disabilityNotes,
        profileQrCode: existingData.profileQrCode || prevState.profileQrCode,
      }));
    } catch (error) {
      console.error("Failed to load existing profile:", error);
    }
  }

  async ensureProfileQrCode() {
    try {
      const user = auth.currentUser;
      if (!user) {
        const fallbackCode = `RR-GUEST-${Date.now().toString().slice(-6)}`;
        this.setState({ profileQrCode: fallbackCode });
        return;
      }

      const existingData = await AuthService.getUserData(user.uid);
      if (existingData?.profileQrCode) {
        this.setState({ profileQrCode: existingData.profileQrCode });
        return;
      }

      const generatedCode = `RR-${user.uid.slice(0, 10).toUpperCase()}`;
      await AuthService.updateUserProfile(user.uid, {
        profileQrCode: generatedCode,
      });
      this.setState({ profileQrCode: generatedCode });
    } catch {
      const fallbackCode = `RR-PROFILE-${Date.now().toString().slice(-6)}`;
      this.setState({ profileQrCode: fallbackCode });
    }
  }

  /**
   * Navigate to next step
   * @private
   */
  handleNext() {
    const { step } = this.state;
    this.setState({
      step: Math.min(this.STEPS.length - 1, step + 1),
    });
  }

  /**
   * Navigate to previous step
   * @private
   */
  handlePrev() {
    const { step } = this.state;
    this.setState({
      step: Math.max(0, step - 1),
    });
  }

  /**
   * Handle input changes for text fields
   * @private
   */
  handleInputChange(e) {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  }

  /**
   * Toggle disability selection
   * @private
   */
  handleDisabilityToggle(key) {
    this.setState((prevState) => ({
      disabilities: {
        ...prevState.disabilities,
        [key]: !prevState.disabilities[key],
      },
    }));
  }

  /**
   * Toggle has disability radio
   * @private
   */
  handleHasDisabilityChange(value) {
    this.setState({ hasDisability: value });
  }

  /**
   * Handle photo upload with compression
   * @private
   */
  handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress image to stay under 1MB Firestore limit
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // Calculate dimensions - more aggressive to stay under 1MB
        let width = img.width;
        let height = img.height;
        const maxDimension = 800; // Reduced from 1200 to ensure smaller size

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        // Create canvas and compress
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with lower quality (0.6) to ensure under 1MB
        let compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);

        // Check size and reduce quality further if needed
        const sizeInBytes = compressedBase64.length;
        const sizeInMB = sizeInBytes / (1024 * 1024);

        if (sizeInMB > 0.9) {
          // If still too large, compress more aggressively
          compressedBase64 = canvas.toDataURL("image/jpeg", 0.4);
        }

        console.log(
          `Compressed photo size: ${(compressedBase64.length / (1024 * 1024)).toFixed(2)} MB`,
        );

        this.setState({
          photo: null, // No need to store File object
          photoUrl: compressedBase64,
          photoPreview: compressedBase64,
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Remove uploaded photo
   * @private
   */
  handleRemovePhoto() {
    this.setState({
      photo: null,
      photoUrl: "",
      photoPreview: null,
    });
  }

  /**
   * Handle file uploads
   * @private
   */
  handleFilesChange(e) {
    const chosen = Array.from(e.target.files || []);
    if (chosen.length === 0) return;

    this.setState((prevState) => ({
      files: [...prevState.files, ...chosen],
    }));
  }

  /**
   * Remove file from list
   * @private
   */
  handleRemoveFile(index) {
    this.setState((prevState) => ({
      files: prevState.files.filter((_, i) => i !== index),
    }));
  }

  /**
   * Finish and save profile
   * @private
   */
  async handleFinish() {
    this.setState({ isLoading: true });

    try {
      // Prepare profile data
      const profileData = {
        fullName: this.state.fullName,
        dob: this.state.dob,
        gender: this.state.gender,
        contact: this.state.contact,
        address: this.state.address,
        bloodType: this.state.bloodType,
        photo: this.state.photo,
        photoUrl: this.state.photoUrl,
        hasDisability: this.state.hasDisability,
        disabilities: this.state.disabilities,
        disabilityNotes: this.state.disabilityNotes,
        profileQrCode: this.state.profileQrCode,
        files: this.state.files,
      };

      // Validate before saving
      const validation = ProfileService.validateProfile(profileData);
      if (!validation.isValid) {
        this.setState({
          errors: validation.errors,
          isLoading: false,
        });
        return;
      }

      // Save profile
      await ProfileService.saveProfile(profileData);

      // Clear errors and return
      this.setState({ errors: [], isLoading: false });
      if (this.props.onBack) {
        this.props.onBack();
      }
    } catch (error) {
      this.setState({
        errors: [error.message],
        isLoading: false,
      });
    }
  }

  /**
   * Calculate age from DOB
   * @private
   */
  getAge() {
    const { dob } = this.state;
    if (!dob) return null;
    return ProfileService.getAgeFromDob(dob);
  }

  /**
   * Get selected disabilities count
   * @private
   */
  getSelectedDisabilitiesCount() {
    const { disabilities } = this.state;
    return Object.values(disabilities).filter(Boolean).length;
  }

  /**
   * Render personal information form (Step 0)
   * @private
   */
  renderAboutYouStep() {
    const { fullName, dob, gender, contact, address, bloodType, photoPreview } =
      this.state;

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          this.handleNext();
        }}
      >
        <div className='mb-4'>
          <h3 className='text-sm font-black text-slate-700'>
            Personal Information
          </h3>
          <p className='text-xs text-gray-400'>
            Enter your personal information.
          </p>
        </div>

        {/* Photo Upload Section */}
        <div className='mb-6 p-4 bg-blue-50 border border-blue-100 rounded'>
          <label className='text-xs font-bold text-gray-600 block mb-3'>
            Profile Photo
          </label>
          {!photoPreview ? (
            <div className='border-2 border-dashed border-gray-300 rounded p-6 text-center'>
              <div className='mb-3'>
                <svg
                  width='40'
                  height='40'
                  viewBox='0 0 24 24'
                  fill='none'
                  className='mx-auto text-blue-600'
                >
                  <path
                    d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'
                    fill='currentColor'
                  />
                </svg>
              </div>
              <div className='text-sm font-bold text-slate-700 mb-1'>
                Click to upload your photo
              </div>
              <div className='text-xs text-gray-400 mb-3'>
                JPG, PNG (Max 5MB)
              </div>
              <input
                type='file'
                onChange={this.handlePhotoChange}
                className='hidden'
                id='photo-upload'
                accept='.jpg,.jpeg,.png'
              />
              <button
                type='button'
                onClick={() => document.getElementById("photo-upload").click()}
                className='px-4 py-2 bg-blue-600 text-white rounded font-bold text-xs hover:bg-blue-700'
              >
                Choose Photo
              </button>
            </div>
          ) : (
            <div className='flex gap-4 items-center'>
              <img
                src={photoPreview}
                alt='Profile preview'
                className='w-24 h-24 rounded-lg object-cover border border-gray-300'
              />
              <div>
                <p className='text-xs text-gray-700 mb-3'>
                  Photo uploaded successfully
                </p>
                <button
                  type='button'
                  onClick={this.handleRemovePhoto}
                  className='px-3 py-2 bg-red-600 text-white rounded font-bold text-xs hover:bg-red-700'
                >
                  Remove Photo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='text-xs font-bold text-gray-600'>Full name</label>
            <input
              name='fullName'
              value={fullName}
              onChange={this.handleInputChange}
              className='w-full border rounded px-3 py-2 mt-1 bg-white text-gray-800'
              placeholder='Alex Mendoza'
            />
          </div>

          <div>
            <label className='text-xs font-bold text-gray-600'>
              Date of birth
            </label>
            <input
              name='dob'
              type='date'
              value={dob}
              onChange={this.handleInputChange}
              className='w-full border rounded px-3 py-2 mt-1 bg-white text-gray-800'
            />
          </div>

          <div>
            <label className='text-xs font-bold text-gray-600'>Gender</label>
            <select
              name='gender'
              value={gender}
              onChange={this.handleInputChange}
              className='w-full border rounded px-3 py-2 mt-1 bg-white text-gray-800'
            >
              <option value=''>Select</option>
              <option value='male'>Male</option>
              <option value='female'>Female</option>
              <option value='other'>Other</option>
            </select>
          </div>

          <div>
            <label className='text-xs font-bold text-gray-600'>
              Contact number
            </label>
            <input
              name='contact'
              value={contact}
              onChange={this.handleInputChange}
              className='w-full border rounded px-3 py-2 mt-1 bg-white text-gray-800'
              placeholder='+63 900 000 0000'
            />
          </div>

          <div className='md:col-span-2'>
            <label className='text-xs font-bold text-gray-600'>Address</label>
            <input
              name='address'
              value={address}
              onChange={this.handleInputChange}
              className='w-full border rounded px-3 py-2 mt-1 bg-white text-gray-800'
              placeholder='Street, City, Province'
            />
          </div>

          <div>
            <label className='text-xs font-bold text-gray-600'>
              Blood type
            </label>
            <select
              name='bloodType'
              value={bloodType}
              onChange={this.handleInputChange}
              className='w-full border rounded px-3 py-2 mt-1 bg-white text-gray-800'
            >
              <option value=''>Select</option>
              <option>A+</option>
              <option>A-</option>
              <option>B+</option>
              <option>B-</option>
              <option>AB+</option>
              <option>AB-</option>
              <option>O+</option>
              <option>O-</option>
            </select>
          </div>
        </div>
      </form>
    );
  }

  /**
   * Render disability selection (Step 1)
   * @private
   */
  renderDisabilitiesStep() {
    const { disabilities, hasDisability, disabilityNotes } = this.state;

    return (
      <div>
        {hasDisability && (
          <div className='mb-4'>
            <h3 className='text-sm font-black text-slate-700'>
              Select Disability
            </h3>
            <p className='text-xs text-gray-400'>
              Choose which disability type applies to you (if any).
            </p>
          </div>
        )}

        {hasDisability && (
          <div className='bg-gray-50 rounded p-4 mb-4'>
            <div className='text-xs font-bold text-gray-600 mb-3'>
              Your Selections:
            </div>
            {this.getSelectedDisabilitiesCount() === 0 ? (
              <div className='text-xs text-gray-400'>
                No disabilities selected
              </div>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {Object.keys(disabilities)
                  .filter((k) => disabilities[k])
                  .map((k) => (
                    <div
                      key={k}
                      className='px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold'
                    >
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className='space-y-3 mb-6'>
          <div>
            <label className='text-xs font-bold text-gray-600 mb-2 block'>
              Additional Notes (Optional)
            </label>
            <textarea
              name='disabilityNotes'
              value={disabilityNotes}
              onChange={this.handleInputChange}
              className='w-full border rounded px-3 py-2 text-sm bg-white text-gray-800'
              rows='4'
              placeholder='Describe any additional details about your disability...'
            ></textarea>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render document upload (Step 2)
   * @private
   */
  renderDocumentsStep() {
    const { files } = this.state;

    return (
      <div>
        <div className='mb-4'>
          <h3 className='text-sm font-black text-slate-700'>
            Upload Documents
          </h3>
          <p className='text-xs text-gray-400'>
            Upload your medical certificate and supporting documents.
          </p>
        </div>

        <div className='border-2 border-dashed border-gray-300 rounded p-8 text-center mb-4'>
          <div className='mb-3'>
            <svg
              width='48'
              height='48'
              viewBox='0 0 24 24'
              fill='none'
              className='mx-auto text-blue-600'
            >
              <path
                d='M12 3v10'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                d='M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>
          <div className='text-sm font-bold text-slate-700 mb-2'>
            Click to upload or drag and drop
          </div>
          <div className='text-xs text-gray-400'>
            PDF, JPG, PNG (Max 10MB each)
          </div>
          <input
            type='file'
            multiple
            onChange={this.handleFilesChange}
            className='hidden'
            id='file-upload'
            accept='.pdf,.jpg,.jpeg,.png'
          />
          <button
            onClick={() => document.getElementById("file-upload").click()}
            className='mt-4 px-4 py-2 bg-blue-700 text-white rounded font-bold'
          >
            Choose Files
          </button>
        </div>

        {files.length > 0 && (
          <div className='mb-6'>
            <div className='text-xs font-bold text-gray-600 mb-2'>
              Uploaded Files ({files.length})
            </div>
            <div className='space-y-2'>
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className='flex items-center justify-between bg-gray-50 p-3 rounded border'
                >
                  <div className='text-xs text-gray-700 font-bold'>
                    {file.name}
                  </div>
                  <button
                    onClick={() => this.handleRemoveFile(idx)}
                    className='text-xs text-red-600 hover:text-red-700 font-bold'
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Render review and finish (Step 3)
   * @private
   */
  renderReviewStep() {
    const {
      fullName,
      dob,
      gender,
      contact,
      address,
      bloodType,
      disabilities,
      files,
    } = this.state;

    return (
      <div>
        <div className='mb-4'>
          <h3 className='text-sm font-black text-slate-700'>Review & Finish</h3>
          <p className='text-xs text-gray-400'>
            Review your information before saving.
          </p>
        </div>

        <div className='space-y-4 mb-6'>
          <div className='bg-blue-50 border border-blue-100 rounded p-4'>
            <div className='text-xs font-bold text-blue-900 mb-3'>
              Personal Information
            </div>
            <div className='grid grid-cols-2 gap-2 text-xs'>
              <div>
                <span className='text-gray-600'>Name:</span>{" "}
                <span className='font-bold text-black'>{fullName || "—"}</span>
              </div>
              <div>
                <span className='text-gray-600'>DOB:</span>{" "}
                <span className='font-bold  text-black'>{dob || "—"}</span>
              </div>
              <div>
                <span className='text-gray-600'>Gender:</span>{" "}
                <span className='font-bold text-black'>{gender || "—"}</span>
              </div>
              <div>
                <span className='text-gray-600'>Contact:</span>{" "}
                <span className='font-bold  text-black'>{contact || "—"}</span>
              </div>
              <div className='col-span-2'>
                <span className='text-gray-600'>Address:</span>{" "}
                <span className='font-bold text-black'>{address || "—"}</span>
              </div>
              <div>
                <span className='text-gray-600'>Blood Type:</span>{" "}
                <span className='font-bold  text-black'>
                  {bloodType || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className='bg-green-50 border border-green-100 rounded p-4'>
            <div className='text-xs font-bold text-green-900 mb-2'>
              Disabilities
            </div>
            <div className='text-xs'>
              {this.getSelectedDisabilitiesCount() === 0 ? (
                <span className='text-gray-600'>No disabilities reported</span>
              ) : (
                <span className='font-bold'>
                  {Object.keys(disabilities)
                    .filter((k) => disabilities[k])
                    .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
                    .join(", ")}
                </span>
              )}
            </div>
          </div>

          <div className='bg-purple-50 border border-purple-100 rounded p-4'>
            <div className='text-xs font-bold text-purple-900 mb-2'>
              Documents
            </div>
            <div className='text-xs text-gray-600'>
              {files.length} file{files.length !== 1 ? "s" : ""} uploaded
            </div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render left disability panel (only on Step 1)
   * @private
   */
  renderDisabilityPanel() {
    const { step, hasDisability, disabilities } = this.state;

    if (step !== 1) return null;

    return (
      <div className='lg:col-span-3 bg-white border rounded p-4'>
        <h3 className='text-sm font-black text-slate-700 mb-3'>
          Do you have a disability?
        </h3>
        <div className='flex items-center gap-4 mb-4'>
          <label className='inline-flex items-center gap-3 cursor-pointer'>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                !hasDisability
                  ? "border-blue-600 bg-blue-600"
                  : "border-gray-300 bg-white"
              }`}
            >
              {!hasDisability && (
                <div className='w-2 h-2 bg-white rounded-full'></div>
              )}
            </div>
            <input
              type='radio'
              name='has'
              checked={!hasDisability}
              onChange={() => this.handleHasDisabilityChange(false)}
              className='hidden'
            />
            <span className='text-sm text-gray-700 font-medium'>No</span>
          </label>
          <label className='inline-flex items-center gap-3 cursor-pointer'>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                hasDisability
                  ? "border-blue-600 bg-blue-600"
                  : "border-gray-300 bg-white"
              }`}
            >
              {hasDisability && (
                <div className='w-2 h-2 bg-white rounded-full'></div>
              )}
            </div>
            <input
              type='radio'
              name='has'
              checked={hasDisability}
              onChange={() => this.handleHasDisabilityChange(true)}
              className='hidden'
            />
            <span className='text-sm text-gray-700 font-medium'>Yes</span>
          </label>
        </div>

        {hasDisability && (
          <>
            <div className='text-xs text-gray-500 mb-2 mt-4'>
              Type of Disability (Maximum 5 types)
            </div>

            <div className='space-y-2'>
              <div className='flex flex-col gap-3'>
                {Object.keys(this.DISABILITIES).map((key) => (
                  <label
                    key={key}
                    className='inline-flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors'
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        disabilities[key]
                          ? "border-blue-600 bg-blue-600"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {disabilities[key] && (
                        <svg
                          className='w-3 h-3 text-white'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <path
                            fillRule='evenodd'
                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                            clipRule='evenodd'
                          />
                        </svg>
                      )}
                    </div>
                    <input
                      type='checkbox'
                      checked={disabilities[key]}
                      onChange={() => this.handleDisabilityToggle(key)}
                      className='hidden'
                    />
                    <span className='text-sm text-gray-700 font-medium'>
                      {this.DISABILITIES[key]}
                    </span>
                  </label>
                ))}
              </div>

              <div className='mt-3'>
                <div className='text-xs font-bold text-slate-700 mb-2'>
                  Selected
                </div>
                <div className='flex flex-wrap gap-2'>
                  {this.getSelectedDisabilitiesCount() === 0 && (
                    <div className='text-xs text-gray-400'>None</div>
                  )}
                  {Object.keys(disabilities)
                    .filter((k) => disabilities[k])
                    .map((k) => (
                      <div
                        key={k}
                        className='px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold'
                      >
                        {this.DISABILITIES[k]}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  renderProfileQrCard() {
    const { fullName, gender, bloodType, photoPreview, profileQrCode } =
      this.state;
    const age = this.getAge();
    const qrValue =
      profileQrCode || `RR-PENDING-${Date.now().toString().slice(-6)}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
      qrValue,
    )}`;

    return (
      <div className='bg-white border rounded p-4 h-fit'>
        <div className='bg-blue-700 text-white rounded px-3 py-2 text-sm font-black text-center mb-3'>
          <h1>Resident Profile</h1>
        </div>

        <div className='flex items-start gap-3 mb-3'>
          {photoPreview ? (
            <img
              src={photoPreview}
              alt='Profile'
              className='w-16 h-16 object-cover rounded border border-gray-200'
            />
          ) : (
            <div className='w-16 h-16 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-lg font-black text-slate-600'>
              {fullName ? fullName.charAt(0).toUpperCase() : "R"}
            </div>
          )}
          <div className='text-xs text-slate-700'>
            <div className='font-black text-sm leading-tight'>
              {fullName || "Your Name"}
            </div>
            <div className='text-gray-500 mt-1'>
              {gender && age && bloodType
                ? `(${gender.charAt(0).toUpperCase()} / ${age}) | ${bloodType}`
                : "Complete profile details"}
            </div>
          </div>
        </div>

        <div className='bg-white border border-gray-200 rounded p-2 flex justify-center mb-2'>
          <img
            src={qrImageUrl}
            alt='Unique Profile QR Code'
            className='w-28 h-28'
          />
        </div>

        <div className='text-[10px] text-gray-500 text-center font-bold break-all'>
          QR ID: {qrValue}
        </div>
      </div>
    );
  }

  /**
   * Main render method
   */
  render() {
    const { step, fullName, errors, isLoading } = this.state;

    return (
      <div className='min-h-screen bg-[#f3f4f6]'>
        {/* Header Component with Profile Setup subtitle */}
        <Header subtitle='Profile Setup' logoStyle='svg'></Header>

        {/* Main content */}
        <div className='p-6'>
          <div className='max-w-6xl mx-auto'>
            <div className='bg-white rounded shadow-sm overflow-hidden'>
              {/* Page header with progress */}
              <div className='px-6 py-4 border-b'>
                {/* Back button */}
                <button
                  onClick={this.props.onBack}
                  className='mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 font-semibold transition-colors'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='h-4 w-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M15 19l-7-7 7-7'
                    />
                  </svg>
                  Return to Dashboard
                </button>

                <div className='flex items-start justify-between gap-6 mb-4'>
                  <div className='flex-1 min-w-0'>
                    <h1 className='text-2xl font-black text-[#3a4a5b]'>
                      Setup Your Profile
                    </h1>
                    <p className='text-xs text-gray-500 mt-1'>
                      Welcome back — complete your profile steps.
                    </p>
                  </div>
                  <div className='hidden md:flex md:items-center md:gap-4 shrink-0'>
                    {/* Removed initial-in-circle avatar as requested */}
                    <div>
                      <div className='text-sm font-black'>
                        {fullName || "Your Name"}
                      </div>
                      {/* Removed gender/age/bloodType display as requested */}
                    </div>
                  </div>
                </div>
                {/* QR Claim Section */}
                {this.renderQrClaimSection()}

                {/* Step pills */}
                <div className='flex items-center gap-2 mb-4'>
                  {this.STEPS.map((s, i) => (
                    <StepPill key={s} label={s} active={step === i} />
                  ))}
                </div>

                {/* Progress bar */}
                <div className='mt-4 p-3 rounded border bg-blue-50'>
                  <div className='text-xs font-bold text-blue-900 mb-2'>
                    Progress
                  </div>
                  <div className='w-full bg-white rounded h-2 overflow-hidden'>
                    <div className='flex h-2 gap-2 px-1'>
                      {this.STEPS.map((s, i) => (
                        <div
                          key={s}
                          className={`flex-1 rounded ${
                            i <= step ? "bg-blue-600" : "bg-blue-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className='text-xs text-blue-800 mt-2 font-bold'>
                    {step + 1} of {this.STEPS.length}
                  </div>

                  {/* Error alerts */}
                  {errors.length > 0 && (
                    <div className='mt-3 p-3 bg-red-50 border border-red-200 rounded'>
                      {errors.map((error, idx) => (
                        <div
                          key={idx}
                          className='text-xs text-red-700 font-bold'
                        >
                          • {error}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Navigation buttons */}
                  <div className='mt-3 flex justify-end gap-2'>
                    {step > 0 && (
                      <button
                        onClick={this.handlePrev}
                        disabled={isLoading}
                        className='px-3 py-2 bg-slate-100 border border-slate-200 rounded font-bold text-sm text-slate-800 hover:bg-slate-200 disabled:opacity-50'
                      >
                        Previous
                      </button>
                    )}
                    <button
                      onClick={
                        step === this.STEPS.length - 1
                          ? this.handleFinish
                          : this.handleNext
                      }
                      disabled={isLoading}
                      className='px-3 py-2 bg-blue-700 text-white rounded font-bold text-sm hover:bg-blue-800 disabled:opacity-50'
                    >
                      {isLoading
                        ? "Saving..."
                        : step === this.STEPS.length - 1
                          ? "Finish"
                          : "Next"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Content area */}
              <div className='p-6 grid grid-cols-1 lg:grid-cols-12 gap-6'>
                {/* Left panel - disability selection (Step 1 only) */}
                {this.renderDisabilityPanel()}

                {/* Main content area */}
                <div
                  className={`bg-white border rounded p-6 ${
                    step === 1 || step === 2 || step === 3
                      ? "lg:col-span-9"
                      : "lg:col-span-12"
                  }`}
                >
                  {step === 0 && this.renderAboutYouStep()}
                  {step === 1 && this.renderDisabilitiesStep()}
                  {step === 2 && this.renderDocumentsStep()}
                  {step === 3 && this.renderReviewStep()}
                </div>

                {/* Removed unique profile QR card as requested */}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default SetupProfile;
