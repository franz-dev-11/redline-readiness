/**
 * ViewManager - Manages application navigation and view state
 * OOP pattern: Encapsulates view state and navigation logic
 */
class ViewManager {
  constructor() {
    this.views = {
      SELECTION: "selection",
      RESIDENT_AUTH_SELECTION: "resident-auth-selection",
      INDIVIDUAL_LOGIN: "individual-login",
      FAMILY_LOGIN: "family-login",
      GOV_LOGIN: "gov-login",
      GOV_PENDING_APPROVAL: "gov-pending-approval",
      GOV_REGISTER: "gov-register",
      INDIVIDUAL_REGISTER: "individual-register",
      FAMILY_REGISTER: "family-register",
      HOME: "home",
      ADMIN_DASHBOARD: "admin-dashboard",
      GOV_DASHBOARD: "gov-dashboard",
      SETUP_PROFILE: "setup-profile",
      FAMILY_SETUP_PROFILE: "family-setup-profile",
      VIEW_PROFILE: "view-profile",
      QR_SCAN: "qr-scan",
    };

    this.currentView = this.views.SELECTION;
    this.pendingHomeTab = null;
    this.observers = [];
  }

  /**
   * Navigate to a specific view
   * @param {string} viewName - Name of the view to navigate to
   */
  navigateTo(viewName) {
    if (!this.views[Object.keys(this.views).find((k) => this.views[k] === viewName)]) {
      // Check if viewName exists in views
      const validView = Object.values(this.views).includes(viewName);
      if (!validView) {
        console.warn(`Invalid view: ${viewName}`);
        return;
      }
    }
    this.currentView = viewName;
    this.notifyObservers();
  }

  /**
   * Go back to selection view (default fallback)
   */
  goToSelection() {
    this.navigateTo(this.views.SELECTION);
  }

  /**
   * Go to resident login
   */
  goToResidentLogin() {
    this.navigateTo(this.views.RESIDENT_AUTH_SELECTION);
  }

  /**
   * Go to individual resident login
   */
  goToIndividualLogin() {
    this.navigateTo(this.views.INDIVIDUAL_LOGIN);
  }

  /**
   * Go to family resident login
   */
  goToFamilyLogin() {
    this.navigateTo(this.views.FAMILY_LOGIN);
  }

  /**
   * Go to government login
   */
  goToGovLogin() {
    this.navigateTo(this.views.GOV_LOGIN);
  }

  /**
   * Go to government pending approval page
   */
  goToGovPendingApproval() {
    this.navigateTo(this.views.GOV_PENDING_APPROVAL);
  }

  /**
   * Go to registration
   */
  goToRegister() {
    this.navigateTo(this.views.INDIVIDUAL_REGISTER);
  }

  /**
   * Go to individual registration
   */
  goToIndividualRegister() {
    this.navigateTo(this.views.INDIVIDUAL_REGISTER);
  }

  /**
   * Go to family registration
   */
  goToFamilyRegister() {
    this.navigateTo(this.views.FAMILY_REGISTER);
  }

  /**
   * Go to home/dashboard
   */
  goToHome() {
    this.navigateTo(this.views.HOME);
  }

  /**
   * Go to home/dashboard and request a specific tab to open.
   * @param {string} tabKey - Resident dashboard tab key
   */
  goToHomeWithTab(tabKey) {
    this.pendingHomeTab = String(tabKey || "").trim() || null;
    this.navigateTo(this.views.HOME);
  }

  /**
   * Consume and clear requested home tab.
   * @returns {string|null}
   */
  consumePendingHomeTab() {
    const tab = this.pendingHomeTab;
    this.pendingHomeTab = null;
    return tab;
  }

  /**
   * Go to setup profile
   */
  goToSetupProfile() {
    this.navigateTo(this.views.SETUP_PROFILE);
  }

  /**
   * Go to family setup profile
   */
  goToFamilySetupProfile() {
    this.navigateTo(this.views.FAMILY_SETUP_PROFILE);
  }

  /**
   * Go to view profile
   */
  goToViewProfile() {
    this.navigateTo(this.views.VIEW_PROFILE);
  }

  /**
   * Go to QR scan page
   */
  goToQrScan() {
    this.navigateTo(this.views.QR_SCAN);
  }

  /**
   * Go to government registration
   */
  goToGovRegister() {
    this.navigateTo(this.views.GOV_REGISTER);
  }

  /**
   * Go to admin dashboard
   */
  goToAdminDashboard() {
    this.navigateTo(this.views.ADMIN_DASHBOARD);
  }

  /**
   * Go to government dashboard
   */
  goToGovDashboard() {
    this.navigateTo(this.views.GOV_DASHBOARD);
  }

  /**
   * Get current view
   * @returns {string} Current view name
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * Subscribe to view changes
   * @param {Function} observer - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(observer) {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((obs) => obs !== observer);
    };
  }

  /**
   * Notify all observers of view change
   * @private
   */
  notifyObservers() {
    this.observers.forEach((observer) => observer(this.currentView));
  }
}

// Export singleton instance
export default new ViewManager();
