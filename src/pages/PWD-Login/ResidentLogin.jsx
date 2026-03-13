import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserShield,
  faLock,
  faEyeSlash,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import AuthService from "../../services/AuthService";

import logo from "../../assets/logo.png";
import banner from "../../assets/disaster.jpg";

/**
 * ResidentLogin - OOP Class-based Component
 * Handles resident/PWD login with Firebase authentication
 */
class ResidentLogin extends React.Component {
  handleBack = () => {
    if (this.props.onBack) {
      this.props.onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    }
  };
  constructor(props) {
    super(props);

    this.state = {
      email: "",
      password: "",
      showPassword: false,
      loading: false,
      error: "",
    };

    this.handleLogin = this.handleLogin.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.togglePasswordVisibility = this.togglePasswordVisibility.bind(this);
  }

  handleInputChange(e) {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  }

  togglePasswordVisibility() {
    this.setState((prevState) => ({
      showPassword: !prevState.showPassword,
    }));
  }

  async handleLogin(e) {
    e.preventDefault();
    const { email, password } = this.state;
    this.setState({ loading: true, error: "" });
    const connectionTimeout = setTimeout(() => {
      this.setState({
        loading: false,
        error:
          "Connection timed out. Please check your internet or disable AdBlockers.",
      });
    }, 10000);
    try {
      const user = await AuthService.login(email, password);
      const userData = await AuthService.getUserData(user.uid);
      clearTimeout(connectionTimeout);
      // Check if admin (universal access)
      if (userData?.role === "admin") {
        this.setState({ loading: false });
        if (this.props.onAdminLogin) {
          this.props.onAdminLogin();
        }
        return;
      }
      // Only allow individual resident accounts
      if (
        userData?.userType !== "individual" &&
        userData?.accountType !== "individual"
      ) {
        await AuthService.logout();
        throw new Error("This account is not an individual resident account.");
      }

      if (String(userData?.status || "").toLowerCase() === "inactive") {
        await AuthService.logout();
        throw new Error(
          "Your resident account is inactive. Please contact an administrator.",
        );
      }

      this.setState({ loading: false });
      if (this.props.onLoginSuccess) {
        this.props.onLoginSuccess();
      }
    } catch (err) {
      clearTimeout(connectionTimeout);
      let errorMessage = err.message;
      if (err.message.includes("invalid-credential")) {
        errorMessage = "Invalid email or password.";
      } else if (err.message.includes("network")) {
        errorMessage = "Network blocked. Disable your AdBlocker or VPN.";
      }
      this.setState({
        loading: false,
        error: errorMessage,
      });
    }
  }

  render() {
    const { email, password, showPassword, loading, error } = this.state;
    return (
      <div className='min-h-screen w-full flex items-stretch bg-[#8ea2b3] font-sans relative'>
        {/* Back Button */}
        <button
          type='button'
          className='absolute top-6 left-6 flex items-center text-gray-600 hover:text-black font-semibold text-base z-10 px-4 py-2 rounded transition-colors'
          onClick={this.handleBack}
        >
          <FontAwesomeIcon icon={faArrowLeft} className='mr-2' />
          Back
        </button>
        {/* Left: Login Form */}
        <div className='flex flex-col justify-center items-center w-full md:w-1/2 bg-white px-8 py-12'>
          <div className='w-full max-w-sm mx-auto'>
            <div className='flex justify-center mb-8'>
              <img src={logo} alt='Logo' className='h-16' />
            </div>
            <h1 className='text-3xl font-black text-[#3a4a5b] mb-2 text-center'>
              Welcome back!
            </h1>
            <p className='text-gray-500 mb-8 text-center'>
              Login to your Redline Readiness account to manage your profile and
              devices..
            </p>
            {error && (
              <div className='bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm font-medium animate-bounce text-center'>
                {error}
              </div>
            )}
            <form className='space-y-4' onSubmit={this.handleLogin}>
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-gray-400 pointer-events-none'>
                  <FontAwesomeIcon icon={faUserShield} />
                </span>
                <input
                  required
                  type='email'
                  name='email'
                  placeholder='Enter your email'
                  value={email}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black focus:ring-2 focus:ring-red-200 placeholder-gray-400'
                />
              </div>
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-gray-400 pointer-events-none'>
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  name='password'
                  placeholder='Password'
                  value={password}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-10 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black focus:ring-2 focus:ring-red-200 placeholder-gray-400'
                />
                <span
                  className='absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-gray-400 cursor-pointer'
                  onClick={this.togglePasswordVisibility}
                >
                  <FontAwesomeIcon icon={faEyeSlash} className='text-xs' />
                </span>
              </div>
              <button
                type='submit'
                disabled={loading}
                className={`w-full bg-black text-white font-bold py-3 rounded shadow-lg transition-all active:scale-95 hover:bg-gray-800 disabled:cursor-not-allowed mt-2 ${loading ? 'opacity-100' : 'disabled:opacity-50'}`}
              >
                {loading ? (
                  <span className='flex items-center justify-center'>
                    <svg className='windows-loading-spinner' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'>
                      <circle cx='8' cy='8' r='7' />
                    </svg>
                  </span>
                ) : "Sign in with email"}
              </button>
            </form>
            <div className='text-center mt-6 text-xs font-medium'>
              <span className='text-gray-500'>Don't have an account? </span>
              <button
                type='button'
                onClick={this.props.onRegister}
                className='text-black font-bold hover:underline ml-1'
              >
                Sign Up
              </button>
            </div>
            <div className='flex justify-center gap-4 mt-8 text-xs text-gray-400'>
              <span>Help</span>
              <span>Terms</span>
              <span>Privacy</span>
            </div>
          </div>
        </div>
        {/* Right: Illustration */}
        <div className='hidden md:block w-1/2 bg-gray-200'>
          <div className='h-full w-full flex items-center justify-center'>
            {/* Replace with your own image or illustration */}
            <img
              src={banner}
              alt='Login Illustration'
              className='object-cover h-screen w-full '
            />
          </div>
        </div>
      </div>
    );
  }
}

export default ResidentLogin;
