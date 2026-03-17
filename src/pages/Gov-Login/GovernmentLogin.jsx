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
      forgotOpen: false,
      forgotEmail: "",
      forgotLoading: false,
      forgotMessage: "",
      forgotError: "",
    };

    // Bind methods
    this.handleInputChange = this.handleInputChange.bind(this);
    this.togglePasswordVisibility = this.togglePasswordVisibility.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleForgotSubmit = this.handleForgotSubmit.bind(this);
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
  async handleForgotSubmit(e) {
    e.preventDefault();
    const { forgotEmail } = this.state;
    this.setState({ forgotLoading: true, forgotError: "", forgotMessage: "" });
    try {
      await AuthService.sendPasswordReset(forgotEmail);
      this.setState({
        forgotLoading: false,
        forgotMessage: "Reset link sent! Check your email inbox.",
      });
    } catch (err) {
      this.setState({
        forgotLoading: false,
        forgotError:
          err.message ||
          "Could not send reset link. Make sure the email is correct.",
      });
    }
  }

  /**
   * Handle login submission with admin detection (gov)
   * @private
   */
  async handleSubmit(e) {
    e.preventDefault();
    this.setState({ isLoading: true, error: "" });

    try {
      const { agencyId, password } = this.state;
      console.log("Password value:", password);

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

      if (userData.status === "inactive") {
        await AuthService.logout();
        throw new Error(
          "Your government account is inactive. Please contact an administrator.",
        );
      }

      const normalizedStatus = String(userData.status || "").toLowerCase();
      if (
        normalizedStatus &&
        normalizedStatus !== "active" &&
        normalizedStatus !== "approved"
      ) {
        await AuthService.logout();
        throw new Error(
          "Your account is not authorized for government access.",
        );
      }

      // Active government account
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
    const {
      agencyId,
      password,
      showPassword,
      error,
      isLoading,
      forgotOpen,
      forgotEmail,
      forgotLoading,
      forgotMessage,
      forgotError,
    } = this.state;
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

              <div className='flex justify-end'>
                <button
                  type='button'
                  onClick={() =>
                    this.setState({
                      forgotOpen: true,
                      forgotEmail: agencyId,
                      forgotMessage: "",
                      forgotError: "",
                    })
                  }
                  className='text-xs text-gray-500 hover:text-black hover:underline mt-1'
                >
                  Forgot password?
                </button>
              </div>

              <button
                type='submit'
                disabled={isLoading}
                className={`w-full bg-black text-white font-bold py-3 rounded shadow-lg transition-all active:scale-95 hover:bg-gray-800 disabled:cursor-not-allowed mt-2 ${isLoading ? "opacity-100" : "disabled:opacity-50"}`}
              >
                {isLoading ? (
                  <span className='flex items-center justify-center'>
                    <svg
                      className='windows-loading-spinner'
                      viewBox='0 0 16 16'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <circle cx='8' cy='8' r='7' />
                    </svg>
                  </span>
                ) : (
                  "Sign in with email"
                )}
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

            {forgotOpen && (
              <div
                className='fixed inset-0 z-50 flex items-center justify-center'
                style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
              >
                <div className='bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 px-7 py-7'>
                  <h2 className='text-lg font-black text-slate-800 mb-1'>
                    Reset Password
                  </h2>
                  <p className='text-xs text-gray-500 mb-4'>
                    Enter your agency email and we'll send you a reset link.
                  </p>
                  {forgotMessage && (
                    <div className='bg-green-50 border-l-4 border-green-500 text-green-700 p-3 mb-3 text-xs font-medium rounded'>
                      {forgotMessage}
                    </div>
                  )}
                  {forgotError && (
                    <div className='bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-3 text-xs font-medium rounded'>
                      {forgotError}
                    </div>
                  )}
                  {!forgotMessage && (
                    <form
                      onSubmit={this.handleForgotSubmit}
                      className='space-y-3'
                    >
                      <input
                        required
                        type='email'
                        placeholder='Agency email address'
                        value={forgotEmail}
                        onChange={(e) =>
                          this.setState({ forgotEmail: e.target.value })
                        }
                        className='w-full px-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none text-black focus:ring-2 focus:ring-red-200 placeholder-gray-400'
                      />
                      <button
                        type='submit'
                        disabled={forgotLoading}
                        className={`w-full bg-black text-white font-bold py-3 rounded shadow-lg transition-all hover:bg-gray-800 disabled:cursor-not-allowed ${forgotLoading ? "opacity-100" : "disabled:opacity-60"}`}
                      >
                        {forgotLoading ? (
                          <span className='flex items-center justify-center'>
                            <svg
                              className='windows-loading-spinner'
                              viewBox='0 0 16 16'
                              xmlns='http://www.w3.org/2000/svg'
                            >
                              <circle cx='8' cy='8' r='7' />
                            </svg>
                          </span>
                        ) : (
                          "Send Reset Link"
                        )}
                      </button>
                    </form>
                  )}
                  <button
                    type='button'
                    onClick={() =>
                      this.setState({
                        forgotOpen: false,
                        forgotMessage: "",
                        forgotError: "",
                      })
                    }
                    className='mt-4 w-full text-center text-xs text-gray-400 hover:text-black hover:underline'
                  >
                    {forgotMessage ? "Close" : "Cancel"}
                  </button>
                </div>
              </div>
            )}

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
