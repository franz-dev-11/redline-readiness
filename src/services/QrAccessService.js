import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import AuthService from "./AuthService";

/**
 * QrAccessService - Handles QR registration and access control.
 *
 * Core non-negotiable rule:
 * Resident information can only be displayed when either:
 * 1) The QR is registered and linked to a verified resident/family account, OR
 * 2) The QR is scanned by a logged-in verified LGU/government account.
 */
class QrAccessService {
  constructor() {
    this.db = db;
    this.authService = AuthService;
  }

  isAccountVerified(userData = {}) {
    return (
      userData?.isVerified === true ||
      userData?.verificationStatus === "verified"
    );
  }

  isResidentOrFamily(userData = {}) {
    return (
      userData?.role === "resident" ||
      userData?.userType === "family" ||
      userData?.accountType === "individual" ||
      userData?.accountType === "residential-family"
    );
  }

  isGovernmentAccount(userData = {}) {
    return (
      userData?.role === "government" ||
      userData?.role === "lgu" ||
      userData?.userType === "government"
    );
  }

  /**
   * Register a QR device to a family member (resident/family dashboard flow)
   *
   * Required steps reflected in this method:
   * - user must be logged in
   * - QR deviceId provided (scan or manual input)
   * - assigned family member provided
   * - ownership confirmation required
   */
  async registerDeviceQr({ deviceId, familyMemberId, familyMemberName, confirmOwnership }) {
    const user = this.authService.currentUser;
    if (!user) {
      throw new Error("You must be logged in to register a QR device.");
    }

    if (!deviceId?.trim()) {
      throw new Error("Device QR ID is required.");
    }

    if (!familyMemberId?.trim() && !familyMemberName?.trim()) {
      throw new Error("Assign the QR to a specific family member.");
    }

    if (confirmOwnership !== true) {
      throw new Error("Ownership confirmation is required.");
    }

    const ownerData = await this.authService.getUserData(user.uid);
    if (!ownerData || !this.isResidentOrFamily(ownerData)) {
      throw new Error("Only resident/family accounts can register QR devices.");
    }

    await setDoc(
      doc(this.db, "qrDevices", deviceId.trim()),
      {
        deviceId: deviceId.trim(),
        active: true,
        ownerUid: user.uid,
        ownerRole: ownerData.role || "resident",
        ownerUserType: ownerData.userType || null,
        linkedResidentUid: user.uid,
        linkedResidentVerified: this.isAccountVerified(ownerData),
        linkedFamilyMemberId: familyMemberId?.trim() || null,
        linkedFamilyMemberName: familyMemberName?.trim() || null,
        ownershipConfirmed: true,
        registeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { success: true, deviceId: deviceId.trim() };
  }

  /**
   * Evaluate whether scanner can view personal/medical info from a QR scan.
   */
  async evaluateScanAccess({ deviceId, scannerUid }) {
    if (!deviceId?.trim()) {
      return {
        authorized: false,
        reason: "missing-device-id",
        message: "QR device ID is required.",
      };
    }

    const qrDoc = await getDoc(doc(this.db, "qrDevices", deviceId.trim()));
    if (!qrDoc.exists() || qrDoc.data()?.active !== true) {
      return {
        authorized: false,
        reason: "qr-inactive-or-unregistered",
        message: "Unregistered QR codes are inactive and non-identifiable.",
      };
    }

    const qrData = qrDoc.data();
    let linkedResidentVerified = qrData?.linkedResidentVerified === true;

    if (!linkedResidentVerified && qrData?.linkedResidentUid) {
      const linkedUserData = await this.authService.getUserData(
        qrData.linkedResidentUid,
      );
      linkedResidentVerified = this.isAccountVerified(linkedUserData);
    }

    if (linkedResidentVerified) {
      return {
        authorized: true,
        reason: "linked-verified-resident-family",
        message: "Access granted by linked verified resident/family account.",
        qrData,
      };
    }

    if (!scannerUid) {
      return {
        authorized: false,
        reason: "scanner-not-authenticated",
        message: "No personal or medical information can be displayed.",
      };
    }

    const scannerData = await this.authService.getUserData(scannerUid);
    const isVerifiedGov =
      this.isGovernmentAccount(scannerData) && this.isAccountVerified(scannerData);

    if (isVerifiedGov) {
      return {
        authorized: true,
        reason: "verified-government-scanner",
        message: "Access granted for logged-in verified LGU/government account.",
        qrData,
      };
    }

    return {
      authorized: false,
      reason: "authorization-rule-not-met",
      message: "No personal or medical information can be displayed.",
    };
  }

  /**
   * Safe resident data retrieval for scan results.
   * Returns null residentData when access is not authorized.
   */
  async getResidentDataForScan({ deviceId, scannerUid }) {
    const access = await this.evaluateScanAccess({ deviceId, scannerUid });
    if (!access.authorized) {
      return {
        ...access,
        residentData: null,
      };
    }

    const linkedResidentUid = access.qrData?.linkedResidentUid;
    if (!linkedResidentUid) {
      return {
        authorized: false,
        reason: "qr-not-linked",
        message: "No personal or medical information can be displayed.",
        residentData: null,
      };
    }

    const residentData = await this.authService.getUserData(linkedResidentUid);

    return {
      authorized: true,
      reason: access.reason,
      message: access.message,
      residentData,
      qrData: access.qrData,
    };
  }
}

export default new QrAccessService();
