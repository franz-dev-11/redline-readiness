import { db } from "../firebase";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

class EmergencyEventService {
  constructor() {
    this.db = db;
    this.collectionName = "emergencyEvents";
  }

  async createEvent(payload) {
    return addDoc(collection(this.db, this.collectionName), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }

  async createSosEvent(payload) {
    return this.createEvent({
      type: "sos",
      status: "active",
      ...payload,
    });
  }

  async createLocationShareEvent(payload) {
    return this.createEvent({
      type: "location-share",
      status: "active",
      ...payload,
    });
  }

  async createLocationShareStoppedEvent(payload) {
    return this.createEvent({
      type: "location-share",
      status: "stopped",
      ...payload,
    });
  }

  async createAnnouncementEvent(payload) {
    return this.createEvent({
      type: "announcement",
      status: "published",
      ...payload,
    });
  }

  async createResolutionEvent(payload) {
    return this.createEvent({
      type: "resolution",
      status: "resolved",
      ...payload,
    });
  }

  subscribeToRecentEvents(callback, maxItems = 12) {
    const eventsRef = collection(this.db, this.collectionName);
    const eventsQuery = query(
      eventsRef,
      orderBy("createdAt", "desc"),
      limit(maxItems),
    );

    return onSnapshot(eventsQuery, (snapshot) => {
      const events = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));

      callback(events);
    });
  }
}

export default new EmergencyEventService();
