import React from "react";
import { AnimatePresence } from "framer-motion";
import LoginSelection from "./pages/LoginSelection/LoginSelection";
import ResidentLogin from "./pages/PWD-Login/ResidentLogin";
import FamilyLogin from "./pages/PWD-Login/FamilyLogin";
import GovernmentLogin from "./pages/Gov-Login/GovernmentLogin";
import GovernmentRegister from "./pages/Gov-Login/GovernmentRegister";
import ResidentRegister from "./pages/PWD-Login/ResidentRegister";
import FamilyRegister from "./pages/PWD-Login/FamilyRegister";
import ResidentDashboard from "./pages/Resident-Home/ResidentDashboard";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import GovernmentDashboard from "./pages/Gov-Home/GovernmentDashboard.jsx";
import SetupProfile from "./pages/Profile/SetupProfile";
import ViewProfile from "./pages/Profile/ViewProfile";
import ViewManager from "./services/ViewManager";
import PageTransition from "./components/PageTransition";

/**
 * App - Main application component (OOP Class-based)
 * Handles routing and view management
 */
class App extends React.Component {
  constructor(props) {
    super(props);

    // Initialize state with current view
    this.state = {
      currentView: ViewManager.getCurrentView(),
    };

    // Bind methods
    this.handleViewChange = this.handleViewChange.bind(this);
    this.renderWithTransition = this.renderWithTransition.bind(this);
    this.renderView = this.renderView.bind(this);
  }

  renderWithTransition(viewKey, content) {
    return <PageTransition pageKey={viewKey}>{content}</PageTransition>;
  }

  componentDidMount() {
    // Subscribe to view changes
    this.unsubscribe = ViewManager.subscribe(this.handleViewChange);
  }

  componentWillUnmount() {
    // Clean up subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  /**
   * Handle view changes from ViewManager
   * @param {string} newView - The new view to display
   */
  handleViewChange(newView) {
    this.setState({ currentView: newView });
  }

  /**
   * Render the appropriate component based on current view
   * @returns {JSX.Element} The view component
   */
  renderView() {
    const { currentView } = this.state;

    switch (currentView) {
      case "selection":
        return this.renderWithTransition(
          "selection",
          <LoginSelection
            onSelectResident={() => ViewManager.goToResidentLogin()}
            onSelectGov={() => ViewManager.goToGovLogin()}
          />,
        );

      case "resident-auth-selection":
        return this.renderWithTransition(
          "resident-auth-selection",
          <LoginSelection
            onSelectResident={() => ViewManager.goToIndividualLogin()}
            onSelectGov={() => ViewManager.goToFamilyLogin()}
            residentAuthMode
            onBack={() => ViewManager.goToSelection()}
          />,
        );

      case "individual-login":
        return this.renderWithTransition(
          "individual-login",
          <ResidentLogin
            onBack={() => ViewManager.goToResidentLogin()}
            onRegister={() => ViewManager.goToIndividualRegister()}
            onLoginSuccess={() => ViewManager.goToHome()}
            onAdminLogin={() => ViewManager.goToAdminDashboard()}
          />,
        );

      case "family-login":
        return this.renderWithTransition(
          "family-login",
          <FamilyLogin
            onBack={() => ViewManager.goToResidentLogin()}
            onRegister={() => ViewManager.goToFamilyRegister()}
            onLoginSuccess={() => ViewManager.goToHome()}
            onAdminLogin={() => ViewManager.goToAdminDashboard()}
          />,
        );

      case "gov-login":
        return this.renderWithTransition(
          "gov-login",
          <GovernmentLogin
            onBack={() => ViewManager.goToSelection()}
            onRegister={() => ViewManager.goToGovRegister()}
            onAdminLogin={() => ViewManager.goToAdminDashboard()}
            onGovLogin={() => ViewManager.goToGovDashboard()}
          />,
        );

      case "gov-register":
        return this.renderWithTransition(
          "gov-register",
          <GovernmentRegister onBack={() => ViewManager.goToGovLogin()} />,
        );

      case "admin-dashboard":
        return this.renderWithTransition(
          "admin-dashboard",
          <AdminDashboard onLogout={() => ViewManager.goToSelection()} />,
        );

      case "gov-dashboard":
        return this.renderWithTransition(
          "gov-dashboard",
          <GovernmentDashboard
            onLogout={() => ViewManager.goToSelection()}
            onBack={() => ViewManager.goToSelection()}
          />,
        );

      case "individual-register":
        return this.renderWithTransition(
          "individual-register",
          <ResidentRegister onBack={() => ViewManager.goToIndividualLogin()} />,
        );

      case "family-register":
        return this.renderWithTransition(
          "family-register",
          <FamilyRegister onBack={() => ViewManager.goToFamilyLogin()} />,
        );

      case "home":
        return this.renderWithTransition(
          "home",
          <ResidentDashboard
            onLogout={() => ViewManager.goToSelection()}
            onOpenSetup={() => ViewManager.goToSetupProfile()}
            onViewProfile={() => ViewManager.goToViewProfile()}
          />,
        );

      case "setup-profile":
        return this.renderWithTransition(
          "setup-profile",
          <SetupProfile onBack={() => ViewManager.goToHome()} />,
        );

      case "view-profile":
        return this.renderWithTransition(
          "view-profile",
          <ViewProfile onBack={() => ViewManager.goToHome()} />,
        );

      default:
        return this.renderWithTransition(
          "selection-default",
          <LoginSelection
            onSelectResident={() => ViewManager.goToResidentLogin()}
            onSelectGov={() => ViewManager.goToGovLogin()}
          />,
        );
    }
  }

  render() {
    return (
      <div className='App' style={{ position: "relative", minHeight: "100vh" }}>
        <AnimatePresence mode='sync' initial={false}>
          {this.renderView()}
        </AnimatePresence>
      </div>
    );
  }
}

export default App;
