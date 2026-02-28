import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuildingColumns,
  faLock,
  faEyeSlash,
  faEye,
  faEnvelope,
  faBuilding,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";
import AuthService from "../../services/AuthService";
import logo from "../../assets/logo.png";
import banner from "../../assets/disaster.jpg";

/**
 * GovernmentRegister - OOP Class-based Component
 * Handles government agency registration with pending approval status
 */
class GovernmentRegister extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      agencyName: "",
      agencyType: "",
      email: "",
      contactNumber: "",
      password: "",
      confirmPassword: "",
      showPassword: false,
      showConfirmPassword: false,
      errors: [],
      isLoading: false,
      successMessage: "",
    };

    // Bind methods
    this.handleInputChange = this.handleInputChange.bind(this);
    this.togglePasswordVisibility = this.togglePasswordVisibility.bind(this);
    this.toggleConfirmPasswordVisibility =
      this.toggleConfirmPasswordVisibility.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  /**
   * Handle input changes
   * @private
   */
  handleInputChange(e) {
    const { name, value } = e.target;
    this.setState({ [name]: value, errors: [] });
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
   * Toggle confirm password visibility
   * @private
   */
  toggleConfirmPasswordVisibility() {
    this.setState((prevState) => ({
      showConfirmPassword: !prevState.showConfirmPassword,
    }));
  }

  /**
   * Validate registration data
   * @private
   */
  validateForm() {
    const errors = [];
    const {
      agencyName,
      agencyType,
      email,
      contactNumber,
      password,
      confirmPassword,
    } = this.state;

    if (!agencyName.trim()) errors.push("Agency name is required");
    if (!agencyType) errors.push("Agency type is required");
    if (!email.trim()) errors.push("Email is required");
    if (!email.includes("@")) errors.push("Invalid email format");
    if (!contactNumber.trim()) errors.push("Contact number is required");
    if (password.length < 6)
      errors.push("Password must be at least 6 characters");
    if (password !== confirmPassword) errors.push("Passwords do not match");

    return errors;
  }

  /**
   * Handle registration submission
   * @private
   */
  async handleSubmit(e) {
    e.preventDefault();

    const errors = this.validateForm();
    if (errors.length > 0) {
      this.setState({ errors });
      return;
    }

    this.setState({ isLoading: true, errors: [] });

    try {
      const { agencyName, agencyType, email, contactNumber, password } =
        this.state;

      // Register government account with pending status
      await AuthService.registerGovernmentAccount({
        agencyName,
        agencyType,
        email,
        contactNumber,
        password,
      });

      this.setState({
        successMessage:
          "Registration successful! Your account is pending approval.",
        isLoading: false,
        agencyName: "",
        agencyType: "",
        email: "",
        contactNumber: "",
        password: "",
        confirmPassword: "",
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        if (this.props.onBack) {
          this.props.onBack();
        }
      }, 3000);
    } catch (error) {
      this.setState({
        errors: [error.message],
        isLoading: false,
      });
    }
  }

  render() {
    const {
      agencyName,
      agencyType,
      email,
      contactNumber,
      password,
      confirmPassword,
      showPassword,
      showConfirmPassword,
      errors,
      isLoading,
      successMessage,
    } = this.state;

    return (
      <div className='min-h-screen w-full flex items-stretch bg-[#8ea2b3] font-sans relative'>
        <div className='flex flex-col justify-center items-center w-full md:w-1/2 bg-white px-8 py-12'>
          <div className='w-full max-w-xl mx-auto'>
            <div className='flex justify-center mb-8'>
              <img src={logo} alt='Logo' className='h-16' />
            </div>
            <h2 className='text-3xl font-black text-[#3a4a5b] mb-2 text-center uppercase'>
              Government Agency
            </h2>
            <p className='text-gray-500 mb-8 text-center'>
              Request government access for your agency
            </p>

            {/* Success Message */}
            {successMessage && (
              <div className='mb-4 p-3 bg-green-50 border border-green-200 rounded text-center'>
                <p className='text-green-700 text-sm font-bold text-center'>
                  {successMessage}
                </p>
              </div>
            )}

            {/* Error Messages */}
            {errors.length > 0 && (
              <div className='mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded'>
                {errors.map((error, idx) => (
                  <p key={idx} className='text-red-700 text-xs font-bold'>
                    • {error}
                  </p>
                ))}
              </div>
            )}

            <form
              className='grid grid-cols-1 md:grid-cols-2 gap-4'
              onSubmit={this.handleSubmit}
            >
              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faBuilding} />
                </span>
                <input
                  type='text'
                  name='agencyName'
                  placeholder='Agency Name'
                  value={agencyName}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-black'
                />
              </div>

              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faBuildingColumns} />
                </span>
                <select
                  name='agencyType'
                  value={agencyType}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-black'
                >
                  <option value=''>Select Agency Type</option>
                  <option value='lgu'>Local Government Unit (LGU)</option>
                  <option value='barangay'>Barangay Office</option>
                  <option value='disaster'>Disaster Response Team</option>
                  <option value='health'>Health Services</option>
                  <option value='police'>Police Department</option>
                  <option value='fire'>Fire Department</option>
                  <option value='other'>Other Government Agency</option>
                </select>
              </div>

              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  type='email'
                  name='email'
                  placeholder='Official Agency Email'
                  value={email}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-black'
                />
              </div>

              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faPhone} />
                </span>
                <input
                  type='tel'
                  name='contactNumber'
                  placeholder='Contact Number'
                  value={contactNumber}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-black'
                />
              </div>

              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  name='password'
                  placeholder='Password'
                  value={password}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-10 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-black'
                />
                <span
                  className='absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer'
                  onClick={this.togglePasswordVisibility}
                >
                  <FontAwesomeIcon
                    icon={showPassword ? faEye : faEyeSlash}
                    className='text-xs hover:text-gray-600'
                  />
                </span>
              </div>

              <div className='relative'>
                <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400'>
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name='confirmPassword'
                  placeholder='Confirm Password'
                  value={confirmPassword}
                  onChange={this.handleInputChange}
                  className='w-full pl-10 pr-10 py-3 border border-gray-200 rounded bg-[#f3f4f6] text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-black'
                />
                <span
                  className='absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 cursor-pointer'
                  onClick={this.toggleConfirmPasswordVisibility}
                >
                  <FontAwesomeIcon
                    icon={showConfirmPassword ? faEye : faEyeSlash}
                    className='text-xs hover:text-gray-600'
                  />
                </span>
              </div>

              <button
                type='submit'
                disabled={isLoading}
                className='md:col-span-2 w-full bg-black text-white font-bold py-3 rounded-md shadow-lg transition-all hover:bg-gray-800 active:scale-95 mt-4 disabled:opacity-50'
              >
                {isLoading ? "Registering..." : "Register Agency"}
              </button>
            </form>

            <div className='text-center mt-6 text-xs font-medium'>
              <span className='text-gray-500'>Already have an account? </span>
              <button
                onClick={this.props.onBack}
                className='text-black font-black hover:underline ml-1'
              >
                Login Here
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
              alt='Government Register Illustration'
              className='object-cover h-screen w-full grayscale'
            />
          </div>
        </div>
      </div>
    );
  }
}

export default GovernmentRegister;
