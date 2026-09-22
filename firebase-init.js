// Optional cloud backend. If firebase-config.js still has placeholder values,
// this quietly no-ops and the app stays in local-only (device-storage) mode.
(async function () {
  function notReady() {
    window.RepLogCloud = null;
    document.dispatchEvent(new Event("replog-cloud-ready"));
  }

  var cfg = window.REP_LOG_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf("YOUR_") === 0) {
    notReady();
    return;
  }

  try {
    var SDK = "https://www.gstatic.com/firebasejs/10.13.2/";
    var appMod = await import(SDK + "firebase-app.js");
    var authMod = await import(SDK + "firebase-auth.js");
    var fsMod = await import(SDK + "firebase-firestore.js");

    var app = appMod.initializeApp(cfg);
    var auth = authMod.getAuth(app);
    var db = fsMod.getFirestore(app);
    var provider = new authMod.GoogleAuthProvider();

    window.RepLogCloud = {
      onAuthChange: function (cb) {
        return authMod.onAuthStateChanged(auth, cb);
      },
      signIn: function () {
        return authMod.signInWithPopup(auth, provider);
      },
      signOutUser: function () {
        return authMod.signOut(auth);
      },
      watchSets: function (uid, cb) {
        var q = fsMod.query(
          fsMod.collection(db, "users", uid, "sets"),
          fsMod.orderBy("createdAt", "desc"),
          fsMod.limit(2000)
        );
        return fsMod.onSnapshot(
          q,
          function (snap) {
            cb(snap.docs.map(function (d) { var data = d.data(); data.id = d.id; return data; }));
          },
          function () { cb(null); }
        );
      },
      watchCustomExercises: function (uid, cb) {
        return fsMod.onSnapshot(
          fsMod.collection(db, "users", uid, "customExercises"),
          function (snap) {
            cb(snap.docs.map(function (d) { var data = d.data(); data.id = d.id; return data; }));
          },
          function () { cb(null); }
        );
      },
      saveSets: function (uid, sets) {
        var batch = fsMod.writeBatch(db);
        sets.forEach(function (s) { batch.set(fsMod.doc(db, "users", uid, "sets", s.id), s); });
        return batch.commit();
      },
      saveCustomExercise: function (uid, ex) {
        return fsMod.setDoc(fsMod.doc(db, "users", uid, "customExercises", ex.id), ex);
      },
      migrateLocalData: function (uid, sets, customExercises) {
        var batch = fsMod.writeBatch(db);
        sets.forEach(function (s) { batch.set(fsMod.doc(db, "users", uid, "sets", s.id), s); });
        customExercises.forEach(function (e) { batch.set(fsMod.doc(db, "users", uid, "customExercises", e.id), e); });
        return batch.commit();
      }
    };
    document.dispatchEvent(new Event("replog-cloud-ready"));
  } catch (e) {
    notReady();
  }
})();
