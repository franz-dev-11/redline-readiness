import { db } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

function normalizeSnapshotDoc(snapshotDoc) {
  const rawData = snapshotDoc.data();
  const normalizedData = {};

  Object.entries(rawData).forEach(([key, value]) => {
    normalizedData[key] =
      value && typeof value.toDate === "function" ? value.toDate() : value;
  });

  return {
    id: snapshotDoc.id,
    ...normalizedData,
  };
}

function getTimestampValue(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortByNewest(items, fieldName) {
  return [...items].sort(
    (left, right) =>
      getTimestampValue(right?.[fieldName]) - getTimestampValue(left?.[fieldName]),
  );
}

function normalizeResponderRecord(record) {
  return {
    ...record,
    name:
      record.name ||
      record.fullName ||
      record.responderName ||
      record.memberName ||
      "Unnamed responder",
    role:
      record.role ||
      record.position ||
      record.specialization ||
      record.assignment ||
      "Responder",
    contactInfo:
      record.contactInfo ||
      record.contact ||
      record.contactNumber ||
      record.phone ||
      record.mobileNumber ||
      "No contact info",
  };
}

class GovResponseTeamsService {
  constructor() {
    this.db = db;
    this.respondersCollection = "govResponseResponders";
    this.teamsCollection = "govResponseTeams";
    this.deploymentsCollection = "govResponseDeployments";
    this.notesCollection = "govResponseTeamNotes";
  }

  subscribeToResponders(callback) {
    const respondersRef = collection(this.db, this.respondersCollection);

    return onSnapshot(respondersRef, (snapshot) => {
      const responders = snapshot.docs
        .map(normalizeSnapshotDoc)
        .map(normalizeResponderRecord);
      callback(sortByNewest(responders, "createdAt"));
    });
  }

  subscribeToTeams(callback) {
    const teamsRef = collection(this.db, this.teamsCollection);

    return onSnapshot(teamsRef, (snapshot) => {
      callback(sortByNewest(snapshot.docs.map(normalizeSnapshotDoc), "createdAt"));
    });
  }

  subscribeToDeployments(callback) {
    const deploymentsRef = collection(this.db, this.deploymentsCollection);

    return onSnapshot(deploymentsRef, (snapshot) => {
      callback(
        sortByNewest(snapshot.docs.map(normalizeSnapshotDoc), "createdAt"),
      );
    });
  }

  subscribeToTeamNotes(callback) {
    const notesRef = collection(this.db, this.notesCollection);

    return onSnapshot(notesRef, (snapshot) => {
      callback(sortByNewest(snapshot.docs.map(normalizeSnapshotDoc), "timestamp"));
    });
  }

  async createResponder(payload) {
    return addDoc(collection(this.db, this.respondersCollection), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }

  async createTeam(payload) {
    return addDoc(collection(this.db, this.teamsCollection), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }

  async updateTeam(teamId, payload) {
    const teamRef = doc(this.db, this.teamsCollection, teamId);

    await updateDoc(teamRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  }

  async createDeployment(payload) {
    return addDoc(collection(this.db, this.deploymentsCollection), {
      ...payload,
      createdAt: serverTimestamp(),
      resolvedAt: null,
    });
  }

  async updateDeploymentStatus(deploymentId, nextStatus) {
    const deploymentRef = doc(this.db, this.deploymentsCollection, deploymentId);

    await updateDoc(deploymentRef, {
      status: nextStatus,
      resolvedAt: nextStatus === "Resolved" ? serverTimestamp() : null,
    });
  }

  async createTeamNote(payload) {
    return addDoc(collection(this.db, this.notesCollection), {
      ...payload,
      timestamp: serverTimestamp(),
    });
  }
}

export default new GovResponseTeamsService();