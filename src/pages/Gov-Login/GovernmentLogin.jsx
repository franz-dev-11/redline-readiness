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
 * GovernmentLogin - OOP Class-based Component
 * Handles government agency login with admin detection
 */
class GovernmentLogin extends React.Component {
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
      agencyId: "",
      password: "",
      showPassword: false,
      error: "",
      isLoading: false,
    };

    // Bind methods
    this.handleInputChange = this.handleInputChange.bind(this);
    this.togglePasswordVisibility = this.togglePasswordVisibility.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  /**
   * Handle input changes
   * @private
   */
  handleInputChange(e) {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  }

  /**
   * Toggle password visibility
   * @private
   */
  togglePasswordVisibility() {
    this.setState((prevState) => ({
      showPassword: !prevState.showPassword,
    }));
  }

  /**
   * Handle login submission with admin detection
   * @private
   */
  async handleSubmit(e) {
    e.preventDefault();
    this.setState({ isLoading: true, error: "" });

    try {
      const { agencyId, password } = this.state;

      // Login with AuthService
      const user = await AuthService.login(agencyId, password);

      // Get user data from Firestore
      const userData = await AuthService.getUserData(user.uid);

      if (!userData) {
        throw new Error("User data not found");
      }

      // Check if admin (universal access)
      if (userData.role === "admin") {
        if (this.props.onAdminLogin) {
          this.props.onAdminLogin();
        }
        return;
      }

      // Check if government account
      if (userData.role !== "government") {
        await AuthService.logout();
        throw new Error("This login is only for government accounts");
      }

      // Check account status
      if (userData.status === "pending") {
        await AuthService.logout();

        if (this.props.onPendingApproval) {
          this.props.onPendingApproval();
          return;
        }

        throw new Error(
          "Your account is pending approval. Please wait for administrator verification.",
        );
      }

      if (userData.status === "rejected") {
        await AuthService.logout();
        throw new Error(
          "Your account registration was rejected. Please contact administrator.",
        );
      }

      // Approved government account
      if (this.props.onGovLogin) {
        this.props.onGovLogin();
      }
    } catch (error) {
      this.setState({
        error: error.message,
        isLoading: false,
      });
    }
  }

  render() {
    const { agencyId, password, showPassword, error, isLoading } = this.state;
    return (
      <div className='min-h-screen w-full flex items-stretch bg-[#8ea2b3] font-sans relative'>
        <button
          type='button'
          className='absolute top-6 left-6 flex items-center text-gray-600 hover:text-black font-semibold text-base z-10 px-4 py-2 rounded transition-colors'
          onClick={this.handleBack}
        >
          <FontAwesomeIcon icon={faArrowLeft} className='mr-2' />
          Back
        </button>

        <div className='flex flex-col justify-center items-center w-full md:w-1/2 bg-white px-8 py-12'>
          <div className='w-full max-w-sm mx-auto'>
            <div className='flex justify-center mb-8'>
              <img src={logo} alt='Logo' className='h-16' />
            </div>
            <h1 className='text-3xl font-black text-[#3a4a5b] mb-2 text-center'>
              Government Login
            </h1>
            <p className='text-gray-500 mb-8 text-center'>
              For LGU and authorized response teams only.
            </p>

            {error && (
              <div className='bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm font-medium text-center'>
                {error}
              </div>
            )}

            <form className='space-y-4' onSubmit={this.handleSubmit}>
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-gray-400 pointer-events-none'>
                  <FontAwesomeIcon icon={faUserShield} />
                </span>
                <input
                  type='text'
                  name='agencyId'
                  placeholder='Agency Email or ID'
                  value={agencyId}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black focus:ring-2 focus:ring-red-200 placeholder-gray-400'
                />
              </div>

              <div className='relative'>
                <span className='absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-gray-400 pointer-events-none'>
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
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
                  <FontAwesomeIcon
                    icon={faEyeSlash}
                    className='text-xs hover:text-gray-600'
                  />
                </span>
              </div>

              <button
                type='submit'
                disabled={isLoading}
                className='w-full bg-black text-white font-bold py-3 rounded shadow-lg transition-all active:scale-95 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed mt-2'
              >
                {isLoading ? "Logging in..." : "Sign in with email"}
              </button>
            </form>

            <div className='text-center mt-6 text-xs font-medium'>
              <span className='text-gray-500'>Need agency access? </span>
              <button
                onClick={this.props.onRegister}
                className='text-black font-bold hover:underline ml-1'
              >
                Register Agency
              </button>
            </div>

            <div className='flex justify-center gap-4 mt-8 text-xs text-gray-400'>
              <span>Help</span>
              <span>Terms</span>
              <span>Privacy</span>
            </div>
          </div>
        </div>

        <div className='hidden md:block w-1/2 bg-gray-200'>
          <div className='h-full w-full flex items-center justify-center'>
            <img
              src={banner}
              alt='Government Login Illustration'
              className='object-cover h-screen w-full '
            />
          </div>
        </div>
      </div>
    );
  }
}

export default GovernmentLogin;
