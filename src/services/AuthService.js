import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

/**
 * AuthService - Handles all authentication-related operations
 * OOP pattern: Single responsibility for auth management
 */
class AuthService {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.currentUser = null;
  }

  /**
   * Register a new user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} userData - Additional user data to store
   * @returns {Promise<Object>} User credentials
   */
  async register(email, password, userData = {}) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      const user = userCredential.user;

      // Store additional user data in Firestore
      await setDoc(doc(this.db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        ...userData,
        createdAt: new Date(),
      });

      return user;
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Register a new residential family account
   * @param {Object} payload - Family account payload
   * @param {string} payload.email - User email
   * @param {string} payload.password - User password
   * @param {string} payload.fullName - Full name
   * @param {string} payload.phone - Contact phone
   * @param {string} payload.pwdId - Optional PWD ID
   * @returns {Promise<Object>} Registered user
   */
  async registerResidentialFamily(payload) {
    const { email, password, fullName, phone, pwdId } = payload;

    return this.register(email, password, {
      fullName,
      phone,
      pwdId: pwdId || "N/A",
      role: "resident",
      accountType: "residential-family",
      userType: "family",
    });
  }

  /**
   * Register a new individual resident account
   * @param {Object} payload - Individual account payload
   * @param {string} payload.email - User email
   * @param {string} payload.password - User password
   * @param {string} payload.fullName - Full name
   * @param {string} payload.phone - Contact phone
   * @param {string} payload.pwdId - Optional PWD ID
   * @returns {Promise<Object>} Registered user
   */
  async registerIndividualResident(payload) {
    const { email, password, fullName, phone, pwdId } = payload;

    return this.register(email, password, {
      fullName,
      phone,
      pwdId: pwdId || "N/A",
      role: "resident",
      accountType: "individual",
      userType: "individual",
    });
  }

  /**
   * Register a new government account with pending approval status
   * @param {Object} payload - Government account payload
   * @param {string} payload.email - Official agency email
   * @param {string} payload.password - Password
   * @param {string} payload.agencyName - Name of the agency
   * @param {string} payload.agencyType - Type of agency
   * @param {string} payload.contactNumber - Contact number
   * @returns {Promise<Object>} Registered user
   */
  async registerGovernmentAccount(payload) {
    const { email, password, agencyName, agencyType, contactNumber } = payload;

    return this.register(email, password, {
      email,
      agencyName,
      agencyType,
      contactNumber,
      role: "government",
      status: "pending",
      accountType: "government",
      approvedAt: null,
      approvedBy: null,
    });
  }

  /**
   * Sign in user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User credentials
   */
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      this.currentUser = userCredential.user;
      return userCredential.user;
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await signOut(this.auth);
      this.currentUser = null;
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Get current user data from Firestore
   * @param {string} uid - User ID
   * @returns {Promise<Object>} User data
   */
  async getUserData(uid) {
    try {
      const userDoc = await getDoc(doc(this.db, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to fetch user data: ${error.message}`);
    }
  }

  /**
   * Update user profile data
   * @param {string} uid - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<void>}
   */
  async updateUserProfile(uid, updateData) {
    try {
      await setDoc(doc(this.db, "users", uid), updateData, { merge: true });
    } catch (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  /**
   * Observe auth state changes
   * @param {Function} callback - Callback function on auth state change
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    return onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      callback(user);
    });
  }

  /**
   * Get all pending government accounts
   * @returns {Promise<Array>} Array of pending government accounts
   */
  async getPendingGovernmentAccounts() {
    try {
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const usersRef = collection(this.db, "users");
      const q = query(
        usersRef,
        where("role", "==", "government"),
        where("status", "==", "pending")
      );
      const querySnapshot = await getDocs(q);
      const pendingAccounts = [];
      querySnapshot.forEach((doc) => {
        pendingAccounts.push({ id: doc.id, ...doc.data() });
      });
      return pendingAccounts;
    } catch (error) {
      throw new Error(`Failed to fetch pending accounts: ${error.message}`);
    }
  }

  /**
   * Get total user count
   * @returns {Promise<number>} Total number of users
   */
  async getTotalUserCount() {
    try {
      const { collection, getDocs } = await import("firebase/firestore");
      const usersRef = collection(this.db, "users");
      const querySnapshot = await getDocs(usersRef);
      return querySnapshot.size;
    } catch (error) {
      throw new Error(`Failed to fetch user count: ${error.message}`);
    }
  }

  /**
   * Get active government accounts count
   * @returns {Promise<number>} Number of approved government accounts
   */
  async getActiveGovernmentCount() {
    try {
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const usersRef = collection(this.db, "users");
      const q = query(
        usersRef,
        where("role", "==", "government"),
        where("status", "==", "approved")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      throw new Error(`Failed to fetch active government count: ${error.message}`);
    }
  }

  /**
   * Approve a government account
   * @param {string} userId - ID of the user to approve
   * @param {string} adminId - ID of the admin approving
   * @returns {Promise<void>}
   */
  async approveGovernmentAccount(userId, adminId) {
    try {
      await setDoc(
        doc(this.db, "users", userId),
        {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminId,
        },
        { merge: true }
      );
    } catch (error) {
      throw new Error(`Failed to approve account: ${error.message}`);
    }
  }

  /**
   * Reject a government account
   * @param {string} userId - ID of the user to reject
   * @param {string} adminId - ID of the admin rejecting
   * @returns {Promise<void>}
   */
  async rejectGovernmentAccount(userId, adminId) {
    try {
      await setDoc(
        doc(this.db, "users", userId),
        {
          status: "rejected",
          rejectedAt: new Date(),
          rejectedBy: adminId,
        },
        { merge: true }
      );
    } catch (error) {
      throw new Error(`Failed to reject account: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new AuthService();
