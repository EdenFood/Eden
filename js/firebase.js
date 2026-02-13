// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEPBzcTir3I8meF6c9_NYRDcRJe9j3jW4",
  authDomain: "eden-36e95.firebaseapp.com",
  projectId: "eden-36e95",
  storageBucket: "eden-36e95.firebasestorage.app",
  messagingSenderId: "52400104172",
  appId: "1:52400104172:web:9b8ec71d46dd61500cfbc9",
  measurementId: "G-L6WHRRE7GE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Export wrappers for main script
window.firebaseAuth = auth;
window.firebaseDb = db;
window.googleProvider = googleProvider;
window.firebaseSignInWithPopup = (authObj, provider) => authObj.signInWithPopup(provider);
window.firebaseSignOut = (authObj) => authObj.signOut();
window.onAuthStateChanged = (authObj, cb) => authObj.onAuthStateChanged(cb);

// v9 style helpers
window.firebaseCollection = (dbObj, path) => dbObj.collection(path);
window.firebaseAddDoc = (collectionRef, data) => collectionRef.add(data);
window.firebaseGetDocs = (queryOrCollectionRef) => queryOrCollectionRef.get();
window.firebaseWhere = (field, op, value) => ({ __type: 'where', field, op, value });
window.firebaseOrderBy = (field, direction) => ({ __type: 'orderBy', field, direction: direction || 'asc' });
window.firebaseQuery = (collectionRef, ...constraints) => {
  let ref = collectionRef;
  (constraints || []).forEach((c) => {
    if (!c || !c.__type) return;
    if (c.__type === 'where') ref = ref.where(c.field, c.op, c.value);
    if (c.__type === 'orderBy') ref = ref.orderBy(c.field, c.direction);
  });
  return ref;
};
window.firebaseServerTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

// Review database functions
async function syncReviewsFromDb() {
  if (!window.firebaseDb) {
    return;
  }

  try {
    const colRef = window.firebaseCollection
      ? window.firebaseCollection(window.firebaseDb, 'reviews')
      : window.firebaseDb.collection('reviews');

    const snap = await (window.firebaseGetDocs
      ? window.firebaseGetDocs(colRef)
      : colRef.get());

    const loadedReviews = {};

    snap.forEach(doc => {
      const data = doc.data();
      if (!data || typeof data.dishId === 'undefined') return;

      const dishId = data.dishId;
      if (!loadedReviews[dishId]) {
        loadedReviews[dishId] = [];
      }

      let isoDate;
      const createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        isoDate = createdAt.toDate().toISOString();
      } else if (typeof createdAt === 'string') {
        isoDate = createdAt;
      } else {
        isoDate = new Date().toISOString();
      }

      loadedReviews[dishId].push({
        id: doc.id,
        author: data.author || 'Anonymous user',
        rating: Number(data.rating) || 0,
        text: data.text || '',
        date: isoDate
      });
    });

    reviews = loadedReviews;
    saveReviews();
    renderMenu();
  } catch (err) {
    console.error('Error loading reviews from Firestore:', err);
  }
}

async function saveReviewToDb(dishId, review) {
  if (!window.firebaseDb) return null;

  try {
    const colRef = window.firebaseCollection
      ? window.firebaseCollection(window.firebaseDb, 'reviews')
      : window.firebaseDb.collection('reviews');

    const payload = {
      dishId,
      author: review.author,
      rating: review.rating,
      text: review.text,
      createdAt: window.firebaseServerTimestamp
        ? window.firebaseServerTimestamp()
        : new Date().toISOString()
    };

    const docRef = await (window.firebaseAddDoc
      ? window.firebaseAddDoc(colRef, payload)
      : colRef.add(payload));

    return docRef && docRef.id ? docRef.id : null;
  } catch (err) {
    console.error('Error saving review to Firestore:', err);
    throw err;
  }
}

async function deleteReviewFromDb(reviewId) {
  if (!window.firebaseDb || !reviewId) return;

  try {
    await window.firebaseDb.collection('reviews').doc(reviewId).delete();
  } catch (err) {
    console.error('Error deleting review from Firestore:', err);
  }
}

async function clearReviewsForDishInDb(dishId) {
  if (!window.firebaseDb || !dishId) return;

  try {
    const colRef = window.firebaseCollection
      ? window.firebaseCollection(window.firebaseDb, 'reviews')
      : window.firebaseDb.collection('reviews');

    const queryRef = (window.firebaseQuery && window.firebaseWhere)
      ? window.firebaseQuery(colRef, window.firebaseWhere('dishId', '==', dishId))
      : colRef.where('dishId', '==', dishId);

    const snap = await (window.firebaseGetDocs
      ? window.firebaseGetDocs(queryRef)
      : queryRef.get());

    if (window.firebaseDb.batch) {
      const batch = window.firebaseDb.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } else {
      const promises = [];
      snap.forEach(doc => {
        promises.push(doc.ref.delete());
      });
      await Promise.all(promises);
    }
  } catch (err) {
    console.error('Error clearing reviews in Firestore for dish', dishId, err);
  }
}

// Registration function
window.register = function register(email, pass) {
  return auth.createUserWithEmailAndPassword(email, pass)
    .then(() => {
      alert("Successfully registered!");
    })
    .catch((error) => {
      alert("Error: " + error.message);
      throw error;
    });
}

// Create order function
window.createOrder = function createOrder(cartItems, price) {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in first!");
    return Promise.reject(new Error("User not signed in"));
  }

  return db.collection("orders").add({
    uid: user.uid,
    items: cartItems,
    total: price,
    status: "pending",
    createdAt: new Date().toISOString()
  })
    .then(() => alert("Order saved!"));
}

// Load orders function
window.loadMyOrders = function loadMyOrders() {
  const user = auth.currentUser;
  if (!user) return Promise.resolve([]);

  return db.collection("orders")
    .where("uid", "==", user.uid)
    .get()
    .then((snapshot) => {
      const orders = [];
      snapshot.forEach(doc => {
        orders.push({ id: doc.id, ...doc.data() });
        console.log("Order from database:", doc.data());
      });
      return orders;
    });
}
