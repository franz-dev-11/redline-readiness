import React from "react";
// import * as QRCodeReact from "qrcode.react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faEnvelope,
  faPhone,
  faLock,
  faIdCard,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import AuthService from "../../services/AuthService";
import Header from "../../components/Header";
import logo from "../../assets/logo.png";
import banner from "../../assets/disaster.jpg";

/**
 * ResidentRegister - OOP Class-based Component
 * Handles resident/PWD registration with validation
 */
class ResidentRegister extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      formData: {
        fullName: "",
        email: "",
        phone: "",
        pwdId: "",
        password: "",
        confirmPassword: "",
      },
      loading: false,
      error: "",
      isSuccess: false,
      // profileQrCode: "",
      // devices: [],
    };

    // Bind methods
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleRegister = this.handleRegister.bind(this);
    this.renderSuccessView = this.renderSuccessView.bind(this);
  }

  /**
   * Handle form input changes
   * @private
   */
  handleInputChange(e) {
    const { name, value } = e.target;
    this.setState((prevState) => ({
      formData: {
        ...prevState.formData,
        [name]: value,
      },
    }));
  }

  /**
   * Handle registration submission
   * @private
   */
  async handleRegister(e) {
    e.preventDefault();
    const { formData } = this.state;

    this.setState({ error: "" });

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      this.setState({ error: "Passwords do not match." });
      return;
    }

    this.setState({ loading: true });

    try {
      const registrationPayload = {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone,
        pwdId: formData.pwdId,
      };

      const user =
        await AuthService.registerIndividualResident(registrationPayload);

      console.log("Registration successful:", user.uid);

      // QR code logic removed; handled on home page only
      this.setState({ isSuccess: true, loading: false });

      setTimeout(() => {
        this.props.onBack();
      }, 5000);
    } catch (err) {
      console.error("Registration Error:", err.message);

      let errorMessage = err.message;
      if (err.message.includes("email-already-in-use")) {
        errorMessage = "This email is already in use.";
      }

      this.setState({
        loading: false,
        error: errorMessage,
      });
    }
  }

  /**
   * Render success view
   * @private
   */
  renderSuccessView() {
    // const { profileQrCode, devices } = this.state;
    return (
      <div className='min-h-screen bg-[#8ea2b3] flex flex-col items-center justify-center p-4 font-sans'>
        <div className='bg-white rounded-lg shadow-2xl w-full max-w-md p-10 text-center scale-up-center'>
          <div className='flex justify-center mb-6'>
            <FontAwesomeIcon
              icon={faCircleCheck}
              className='text-green-500 text-7xl'
            />
          </div>
          <h2 className='text-3xl font-black text-[#3a4a5b] mb-2 tracking-tight'>
            Account Created!
          </h2>
          <p className='text-gray-500 mb-4 font-medium'>
            Your registration was successful. Redirecting to the login page...
          </p>
          {/* QR code display removed; now only on home page */}
          <div className='flex justify-center'>
            <div className='w-8 h-8 border-4 border-[#3a4a5b] border-t-transparent rounded-full animate-spin'></div>
          </div>
        </div>
      </div>
    );
  }

  fetchDevices(profileQrCode) {
    // For demo, just one device
    this.setState({
      devices: [
        {
          name: "Resident Device",
          serial: profileQrCode,
          status: "Active",
        },
      ],
    });
  }

  render() {
    const { formData, loading, error, isSuccess } = this.state;

    // Show success view if registration successful
    if (isSuccess) {
      return this.renderSuccessView();
    }

    return (
      <div className='min-h-screen w-full flex items-stretch bg-[#8ea2b3] font-sans relative'>
        {/* Left: Registration Form */}
        <div className='flex flex-col justify-center items-center w-full md:w-1/2 bg-white px-8 py-12'>
          <div className='w-full max-w-xl mx-auto'>
            <div className='flex justify-center mb-8'>
              <img src={logo} alt='Logo' className='h-16' />
            </div>
            <h2 className='text-3xl font-black text-[#3a4a5b] mb-2 text-center uppercase'>
              Individual Account
            </h2>
            <p className='text-gray-500 mb-8 text-center'>
              Register your Redline Readiness resident account.
            </p>
            {error && (
              <div className='bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 text-sm text-center'>
                <p className='font-bold'>Error</p>
                <p>{error}</p>
              </div>
            )}
            <form
              className='grid grid-cols-1 md:grid-cols-2 gap-4'
              onSubmit={this.handleRegister}
            >
              <div className='relative md:col-span-2'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faUser} />
                </span>
                <input
                  required
                  name='fullName'
                  type='text'
                  placeholder='Full Name'
                  value={formData.fullName}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black'
                />
              </div>
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  required
                  name='email'
                  type='email'
                  placeholder='Email Address'
                  value={formData.email}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black'
                />
              </div>
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faPhone} />
                </span>
                <input
                  required
                  name='phone'
                  type='tel'
                  placeholder='Phone Number'
                  value={formData.phone}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black'
                />
              </div>
              <div className='relative md:col-span-2'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faIdCard} />
                </span>
                <input
                  name='pwdId'
                  type='text'
                  placeholder='PWD ID Number (Optional)'
                  value={formData.pwdId}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black'
                />
              </div>
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  required
                  name='password'
                  type='password'
                  placeholder='Password'
                  value={formData.password}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black'
                />
              </div>
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  required
                  name='confirmPassword'
                  type='password'
                  placeholder='Confirm Password'
                  value={formData.confirmPassword}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black'
                />
              </div>
              <button
                type='submit'
                disabled={loading}
                className='md:col-span-2 w-full bg-black text-white font-bold py-3 rounded-md shadow-lg transition-all hover:bg-gray-800 active:scale-95 mt-4 disabled:opacity-50'
              >
                {loading ? "Processing..." : "Register Account"}
              </button>
            </form>
            <div className='text-center mt-6 text-xs font-medium'>
              <span className='text-gray-500'>Already have an account? </span>
              <button
                type='button'
                onClick={this.props.onBack}
                className='text-black font-black hover:underline ml-1'
              >
                Login Now
              </button>
            </div>
          </div>
        </div>
        {/* Right: Illustration */}
        <div className='hidden md:block w-1/2 bg-gray-200'>
          <div className='h-full w-full flex items-center justify-center'>
            <img
              src={banner}
              alt='Register Illustration'
              className='object-cover h-screen w-full grayscale'
            />
          </div>
        </div>
      </div>
    );
  }
}

export default ResidentRegister;
