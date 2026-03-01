import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faPhone,
  faUniversalAccess,
  faSpinner,
  faDownload,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

class ResidentResources extends React.Component {
  static HOTLINES = [
    {
      id: "hotline-1",
      name: "LGU Emergency Response",
      phone: "+63 44 812 3400",
    },
    {
      id: "hotline-2",
      name: "Municipal Health Office",
      phone: "+63 44 812 2210",
    },
    { id: "hotline-3", name: "BFP Sta. Maria", phone: "+63 44 641 1190" },
    { id: "hotline-4", name: "Philippine Red Cross", phone: "+63 2 8790 2300" },
  ];

  static DISASTER_GUIDES = [
    {
      id: "guide-1",
      title: "Typhoon Preparedness for Families",
      format: "PDF",
      url: "https://www.redcross.org.ph/wp-content/uploads/2023/08/Family-Preparedness-Guide.pdf",
    },
    {
      id: "guide-2",
      title: "Earthquake Safety Quick Reference",
      format: "PDF",
      url: "https://www.ready.gov/sites/default/files/2020-03/earthquake_information_sheet_0.pdf",
    },
    {
      id: "guide-3",
      title: "Flood Response and Evacuation Tips",
      format: "PDF",
      url: "https://www.ready.gov/sites/default/files/2020-03/flood_information_sheet_0.pdf",
    },
  ];

  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      savingAccessibility: false,
      userId: null,
      userName: "Resident",
      medicalInfo: {
        bloodType: "Not provided",
        conditions: "Not provided",
        allergies: "Not provided",
        medications: "Not provided",
      },
      accessibility: {
        screenReader: false,
        highContrast: false,
        largeText: false,
      },
    };

    this.loadResourceData = this.loadResourceData.bind(this);
    this.handleToggleAccessibility = this.handleToggleAccessibility.bind(this);
    this.saveAccessibilitySettings = this.saveAccessibilitySettings.bind(this);
    this.toDialNumber = this.toDialNumber.bind(this);
  }

  componentDidMount() {
    this.loadResourceData();
  }

  async loadResourceData() {
    const user = auth.currentUser;

    if (!user) {
      this.setState({ loading: false });
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      if (!snapshot.exists()) {
        this.setState({ loading: false, userId: user.uid });
        return;
      }

      const profile = snapshot.data();
      const personal = profile.personalInfo || {};
      const medical = profile.medicalInfo || {};
      const accessibility = profile.accessibilitySettings || {};

      const selectedDisabilities =
        profile?.selectedDisabilities ||
        Object.keys(profile?.disabilities || {}).filter(
          (key) => profile.disabilities[key],
        );

      this.setState({
        loading: false,
        userId: user.uid,
        userName: profile.fullName || personal.fullName || "Resident",
        medicalInfo: {
          bloodType: personal.bloodType || medical.bloodType || "Not provided",
          conditions:
            medical.conditions ||
            (selectedDisabilities.length > 0
              ? selectedDisabilities.join(", ")
              : "Not provided"),
          allergies: medical.allergies || "Not provided",
          medications:
            medical.medications || profile.disabilityNotes || "Not provided",
        },
        accessibility: {
          screenReader: Boolean(accessibility.screenReader),
          highContrast: Boolean(accessibility.highContrast),
          largeText: Boolean(accessibility.largeText),
        },
      });
    } catch (error) {
      console.error("Failed to load resident resources data:", error);
      this.setState({ loading: false, userId: user.uid });
    }
  }

  toDialNumber(phone) {
    return phone.replace(/[^\d+]/g, "");
  }

  async handleToggleAccessibility(key) {
    this.setState(
      (prevState) => ({
        accessibility: {
          ...prevState.accessibility,
          [key]: !prevState.accessibility[key],
        },
      }),
      this.saveAccessibilitySettings,
    );
  }

  async saveAccessibilitySettings() {
    const { userId, accessibility } = this.state;
    if (!userId) return;

    this.setState({ savingAccessibility: true });

    try {
      await setDoc(
        doc(db, "users", userId),
        {
          accessibilitySettings: accessibility,
        },
        { merge: true },
      );
      this.setState({ savingAccessibility: false });
    } catch (error) {
      console.error("Failed to save accessibility settings:", error);
      this.setState({ savingAccessibility: false });
    }
  }

  render() {
    const {
      loading,
      savingAccessibility,
      userName,
      medicalInfo,
      accessibility,
    } = this.state;

    const wrapperClass = [
      "space-y-4",
      accessibility.highContrast
        ? "[&_p]:text-black [&_h2]:text-black [&_h3]:text-black"
        : "",
      accessibility.largeText ? "text-[1.05rem]" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <section className={wrapperClass}>
        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h2 className='text-xl font-black text-slate-800 uppercase tracking-tight'>
            Emergency Hotlines
          </h2>
          <p className='text-sm text-slate-600 mt-1'>
            Call directly for urgent support.
          </p>

          <div className='mt-4 space-y-2'>
            {ResidentResources.HOTLINES.map((hotline) => (
              <div
                key={hotline.id}
                className='border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3'
              >
                <div>
                  <p className='text-sm font-black text-slate-800 flex items-center gap-2'>
                    <FontAwesomeIcon icon={faPhone} className='text-blue-700' />
                    {hotline.name}
                  </p>
                  <p className='text-sm font-semibold text-slate-600 mt-1'>
                    {hotline.phone}
                  </p>
                </div>
                <a
                  href={`tel:${this.toDialNumber(hotline.phone)}`}
                  className='text-xs font-black uppercase bg-blue-700 text-white px-3 py-2 rounded-lg hover:bg-blue-800'
                >
                  Call
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Medical Info Access
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            View family medical info for {userName}.
          </p>

          {loading ? (
            <div className='mt-4 text-sm font-bold text-slate-500 flex items-center gap-2'>
              <FontAwesomeIcon icon={faSpinner} spin /> Loading medical info...
            </div>
          ) : (
            <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div className='border border-slate-200 rounded-xl p-4 bg-slate-50'>
                <p className='text-xs font-black text-slate-500 uppercase'>
                  Blood type
                </p>
                <p className='text-sm font-semibold text-slate-700 mt-1'>
                  {medicalInfo.bloodType}
                </p>
              </div>
              <div className='border border-slate-200 rounded-xl p-4 bg-slate-50'>
                <p className='text-xs font-black text-slate-500 uppercase'>
                  Conditions
                </p>
                <p className='text-sm font-semibold text-slate-700 mt-1'>
                  {medicalInfo.conditions}
                </p>
              </div>
              <div className='border border-slate-200 rounded-xl p-4 bg-slate-50'>
                <p className='text-xs font-black text-slate-500 uppercase'>
                  Allergies
                </p>
                <p className='text-sm font-semibold text-slate-700 mt-1'>
                  {medicalInfo.allergies}
                </p>
              </div>
              <div className='border border-slate-200 rounded-xl p-4 bg-slate-50'>
                <p className='text-xs font-black text-slate-500 uppercase'>
                  Medications
                </p>
                <p className='text-sm font-semibold text-slate-700 mt-1'>
                  {medicalInfo.medications}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Accessibility Settings
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Toggle accessibility options for easier use.
          </p>

          <div className='mt-4 space-y-2'>
            {[
              { key: "screenReader", label: "Screen reader" },
              { key: "highContrast", label: "High contrast" },
              { key: "largeText", label: "Large text" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => this.handleToggleAccessibility(option.key)}
                className='w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 flex items-center justify-between hover:border-blue-200 transition-colors'
              >
                <span className='text-sm font-black text-slate-700 flex items-center gap-2'>
                  <FontAwesomeIcon
                    icon={faUniversalAccess}
                    className='text-blue-700'
                  />
                  {option.label}
                </span>
                <span
                  className={`text-xs font-black uppercase px-2 py-1 rounded-full ${
                    accessibility[option.key]
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {accessibility[option.key] ? "On" : "Off"}
                </span>
              </button>
            ))}
          </div>

          <p className='mt-3 text-xs font-black uppercase text-slate-500'>
            {savingAccessibility ? (
              <span className='inline-flex items-center gap-2'>
                <FontAwesomeIcon icon={faSpinner} spin /> Saving settings...
              </span>
            ) : (
              "Settings saved to your profile"
            )}
          </p>
        </div>

        <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
          <h3 className='text-lg font-black text-slate-800 uppercase tracking-tight'>
            Disaster Guides
          </h3>
          <p className='text-sm text-slate-600 mt-1'>
            Download or view preparedness materials.
          </p>

          <div className='mt-4 space-y-3'>
            {ResidentResources.DISASTER_GUIDES.map((guide) => (
              <div
                key={guide.id}
                className='border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3'
              >
                <div>
                  <p className='text-sm font-black text-slate-800 flex items-center gap-2'>
                    <FontAwesomeIcon
                      icon={faBookOpen}
                      className='text-blue-700'
                    />
                    {guide.title}
                  </p>
                  <p className='text-xs font-bold text-slate-500 uppercase mt-1'>
                    File format: {guide.format}
                  </p>
                </div>

                <div className='flex items-center gap-2'>
                  <a
                    href={guide.url}
                    target='_blank'
                    rel='noreferrer'
                    className='text-xs font-black uppercase border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:border-blue-300 hover:text-blue-700'
                  >
                    <FontAwesomeIcon icon={faEye} className='mr-2' />
                    View
                  </a>
                  <a
                    href={guide.url}
                    target='_blank'
                    rel='noreferrer'
                    download
                    className='text-xs font-black uppercase bg-blue-700 text-white px-3 py-2 rounded-lg hover:bg-blue-800'
                  >
                    <FontAwesomeIcon icon={faDownload} className='mr-2' />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
}

export default ResidentResources;
