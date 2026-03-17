import AuthService from "./AuthService";
import { serverTimestamp } from "firebase/firestore";

/**
 * ProfileService - Handles profile-related operations
 * OOP pattern: Manages profile data and validation
 */
class ProfileService {
  constructor() {
    this.authService = AuthService;
  }

  /**
   * Save profile data for current user
   * @param {Object} profileData - Profile information
   * @returns {Promise<void>}
   */
  async saveProfile(profileData) {
    try {
      const user = this.authService.currentUser || this.authService.auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }

      // photoUrl is already compressed base64 from SetupProfile
      const photoUrl = profileData.photoUrl || "";
      
      // Log photo size for debugging
      if (photoUrl) {
        const sizeInMB = (photoUrl.length / (1024 * 1024)).toFixed(2);
        console.log(`Saving photo to Firestore. Size: ${sizeInMB} MB`);
      }

      const safeFileMetadata = (profileData.files || []).map((file) => ({
        name: file.name || "unknown",
        size: file.size || 0,
        type: file.type || "application/octet-stream",
        lastModified: file.lastModified || null,
      }));

      const selectedDisabilities = Object.keys(profileData.disabilities || {}).filter(
        (key) => Boolean(profileData.disabilities[key]),
      );

      await this.authService.updateUserProfile(user.uid, {
        personalInfo: {
          fullName: profileData.fullName,
          dob: profileData.dob,
          gender: profileData.gender,
          contact: profileData.contact,
          address: profileData.address,
          bloodType: profileData.bloodType,
          photoUrl,
        },
        photoUrl,
        hasDisability: Boolean(profileData.hasDisability),
        disabilities: profileData.disabilities,
        selectedDisabilities,
        disabilityNotes: profileData.disabilityNotes || "",
        profileQrCode: profileData.profileQrCode || "",
        documentCount: profileData.files?.length || 0,
        uploadedDocuments: safeFileMetadata,
        profileSetup: {
          completedSteps: 4,
          completedAt: serverTimestamp(),
        },
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      });
      
      console.log("Profile saved successfully with photo");
    } catch (error) {
      console.error("ProfileService save error:", error);
      throw new Error(`Failed to save profile: ${error.message}`);
    }
  }

  /**
   * Validate profile data
   * @param {Object} profileData - Profile information
   * @returns {Object} Validation result with errors array
   */
  validateProfile(profileData) {
    const errors = [];

    if (!profileData.fullName?.trim()) {
      errors.push("Full name is required");
    }

    if (!profileData.dob) {
      errors.push("Date of birth is required");
    }

    if (!profileData.gender) {
      errors.push("Gender is required");
    }

    if (!profileData.contact?.trim()) {
      errors.push("Contact number is required");
    }

    if (!profileData.address?.trim()) {
      errors.push("Address is required");
    }

    if (!profileData.bloodType) {
      errors.push("Blood type is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate age from date of birth
   * @param {string} dob - Date of birth
   * @returns {number} Age in years
   */
  getAgeFromDob(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
}

// Export singleton instance
export default new ProfileService();
