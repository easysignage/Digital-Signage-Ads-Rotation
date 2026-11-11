// Ad Rotator: plays one ad per playlist loop and moves to the next ad on the next loop.
//
// Ads live in ../ads and are named by play order: 01.jpg, 02.mp4, 03.png, ... (1.jpg and
// 001.jpg work too).
// A page opened from local files cannot list a folder, so the app looks for the ad
// numbered by its counter, trying each supported extension. When that number is
// missing, the rotation has passed the last ad and starts again at 1.
//
// The player opens index.html each time the playlist reaches this item, so the state
// lives in localStorage: the number of the next ad and, once known, its exact file.
// While an ad plays, the app looks up the next ad's file in the background and saves
// it, so the next start shows the ad straight away instead of searching first.
// If a player keeps the page open between loops, the page moves on when it becomes
// visible again after being hidden.
//
// URL options for testing: ?debug=1 shows the current state and timings, ?reset=1
// starts again at ad 1.
(function () {
  "use strict";

  var IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "svg"];
  var VIDEO_EXT = ["mp4", "mov", "m4v", "webm"];
  var PROBE_TIMEOUT_MS = 8000;
  // Wait before looking up the next ad, so the lookup doesn't compete with the ad
  // that is starting.
  var PREFETCH_DELAY_MS = 1500;

  var VERSION = "1.1.0";
  var startedAt = now();
  var pageOpenedAt = startedAt;
  var settings = window.AD_ROTATOR_SETTINGS || {};
  var stage = document.getElementById("stage");
  var messageBox = document.getElementById("message");
  var debugBox = document.getElementById("debug");
  var params = parseQuery(window.location.search);
  // Keyed by the page's own path so two rotators on one screen keep separate places.
  var storageKey = "adRotator:" + window.location.pathname;
  var storageError = "";
  var storage = pickStorage();
  var visibilityChanges = 0;
  var diag = recordLoad();
  var current = null;
  var shownAfter = null;
  var startedFrom = "";
  var wasHidden = false;
  var busy = false;
  var prefetchTimer = null;

  document.body.style.background = settings.background || "#000";

  if (params.reset === "1") {
    writeState({ next: 1 });
  }

  playNext();

  if (debugOn()) {
    // Keeps "page open for" current, which shows whether the player reloads the page.
    setInterval(showDebug, 1000);
  }

  document.addEventListener("visibilitychange", function () {
    visibilityChanges += 1;
    if (document.hidden) {
      wasHidden = true;
      pauseVideo();
    } else if (wasHidden) {
      wasHidden = false;
      startedAt = now();
      playNext();
    }
  });

  function playNext() {
    if (busy) {
      return;
    }
    busy = true;
    clearTimeout(prefetchTimer);
    var state = readState();

    if (state.src) {
      // The file was found during the previous play: show it at once.
      startedFrom = "saved";
      show({ number: state.next, src: state.src, video: state.video }, function () {
        // The saved file is gone (the package changed): search for it instead.
        startedFrom = "search";
        resolve(state.next, done);
      });
      busy = false;
      return;
    }

    startedFrom = "search";
    resolve(state.next, done);

    function done(ad) {
      busy = false;
      if (!ad) {
        writeState({ next: 1 });
        showMessage("Add your ads to the \"ads\" folder, named 01, 02, 03 and so on.");
        return;
      }
      show(ad);
    }
  }

  // Finds ad number n, or ad 1 when n is past the last ad.
  function resolve(n, callback) {
    findAd(n, function (ad) {
      if (ad || n === 1) {
        callback(ad);
        return;
      }
      findAd(1, callback);
    });
  }

  // Looks for ad number n under every name it may have (01, 1, 001). Images are checked
  // all at once, which is cheap. Videos are checked one at a time, most likely name
  // first, because each check creates a video player and many at once is slow on
  // low-end players. The first match wins, so a stray duplicate (01.jpg and 01.mp4)
  // resolves predictably: images before videos, then the order of the lists above.
  function findAd(n, callback) {
    var names = numberNames(n);
    var images = [];
    var videos = [];
    names.forEach(function (name) {
      IMAGE_EXT.forEach(function (ext) {
        images.push({ number: n, src: "ads/" + name + "." + ext, video: false });
        images.push({ number: n, src: "ads/" + name + "." + ext.toUpperCase(), video: false });
      });
      VIDEO_EXT.forEach(function (ext) {
        videos.push({ number: n, src: "ads/" + name + "." + ext, video: true });
        videos.push({ number: n, src: "ads/" + name + "." + ext.toUpperCase(), video: true });
      });
    });

    probeAll(images, function (image) {
      if (image) {
        callback(image);
        return;
      }
      probeInOrder(videos, 0, callback);
    });
  }

  function probeAll(candidates, callback) {
    var results = new Array(candidates.length);
    var pending = candidates.length;
    candidates.forEach(function (candidate, i) {
      probe(candidate, function (ok) {
        results[i] = ok;
        pending -= 1;
        if (pending === 0) {
          for (var j = 0; j < candidates.length; j++) {
            if (results[j]) {
              callback(candidates[j]);
              return;
            }
          }
          callback(null);
        }
      });
    });
  }

  function probeInOrder(candidates, i, callback) {
    if (i >= candidates.length) {
      callback(null);
      return;
    }
    probe(candidates[i], function (ok) {
      if (ok) {
        callback(candidates[i]);
      } else {
        probeInOrder(candidates, i + 1, callback);
      }
    });
  }

  // The ways ad number n may be written, padded with zeros up to 3 digits:
  // 1 -> 01, 1, 001; 12 -> 12, 012; 123 -> 123.
  function numberNames(n) {
    var plain = String(n);
    var names = [];
    if (plain.length < 2) {
      names.push("0" + plain);
    }
    names.push(plain);
    while (plain.length < 3) {
      plain = "0" + plain;
      if (names.indexOf(plain) === -1) {
        names.push(plain);
      }
    }
    return names;
  }

  function probe(candidate, callback) {
    var finished = false;
    var el = document.createElement(candidate.video ? "video" : "img");
    var timer = setTimeout(function () {
      finish(false);
    }, PROBE_TIMEOUT_MS);

    function finish(ok) {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      el.removeAttribute("src");
      if (candidate.video) {
        el.load();
      }
      callback(ok);
    }

    el.addEventListener(candidate.video ? "loadedmetadata" : "load", function () {
      finish(true);
    });
    el.addEventListener("error", function () {
      finish(false);
    });
    if (candidate.video) {
      el.preload = "metadata";
      el.muted = true;
    }
    el.src = candidate.src;
  }

  // Shows the ad and, while it plays, looks up the one after it. onMissing runs instead
  // if the file can't be loaded.
  function show(ad, onMissing) {
    current = ad;
    shownAfter = null;
    var fit = settings.fit === "cover" ? "cover" : "contain";
    var el;

    // Save the next number before anything else, so a screen switched off mid-ad
    // still moves on.
    writeState({ next: ad.number + 1 });

    if (ad.video) {
      el = document.createElement("video");
      el.muted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.preload = "auto";
      el.setAttribute("muted", "");
      el.setAttribute("playsinline", "");
      el.loop = settings.videoEnd === "loop";
    } else {
      el = document.createElement("img");
      el.alt = "";
      el.decoding = "async";
    }
    el.style.objectFit = fit;

    el.addEventListener(ad.video ? "playing" : "load", function onShown() {
      el.removeEventListener(ad.video ? "playing" : "load", onShown);
      shownAfter = Math.round(now() - startedAt);
      showDebug();
    });
    el.addEventListener("error", function () {
      if (current !== ad) {
        return;
      }
      if (onMissing) {
        onMissing();
      } else {
        showMessage("Could not play " + ad.src);
      }
    });

    el.src = ad.src;
    stage.innerHTML = "";
    stage.appendChild(el);
    messageBox.style.display = "none";

    if (ad.video) {
      var playing = el.play();
      if (playing && playing.catch) {
        playing.catch(function () {});
      }
    }
    showDebug();

    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(function () {
      prefetch(ad.number + 1);
    }, PREFETCH_DELAY_MS);
  }

  // Finds the file for the next play and saves it, so that play starts instantly.
  function prefetch(n) {
    resolve(n, function (next) {
      if (!next) {
        return;
      }
      // Only save if nothing else has moved the rotation on meanwhile.
      if (readState().next !== n) {
        return;
      }
      writeState({ next: next.number, src: next.src, video: next.video });
      showDebug();
    });
  }

  function showMessage(text) {
    current = null;
    stage.innerHTML = "";
    messageBox.textContent = text;
    messageBox.style.display = "flex";
    showDebug();
  }

  function pauseVideo() {
    var video = stage.querySelector("video");
    if (video) {
      video.pause();
    }
  }

  // State is {next, src, video}. Older versions stored just the number.
  function readState() {
    var state = { next: 1, src: "", video: false };
    if (!storage) {
      return state;
    }
    try {
      var raw = storage.getItem(storageKey);
      if (!raw) {
        return state;
      }
      if (raw.charAt(0) === "{") {
        var parsed = JSON.parse(raw);
        state.next = parsed.next >= 1 ? Math.floor(parsed.next) : 1;
        state.src = typeof parsed.src === "string" ? parsed.src : "";
        state.video = parsed.video === true;
      } else {
        var value = parseInt(raw, 10);
        state.next = isNaN(value) || value < 1 ? 1 : value;
      }
    } catch (e) {
      // Unreadable state: start from the first ad.
    }
    return state;
  }

  function writeState(state) {
    if (!storage) {
      return;
    }
    try {
      storage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      // Storage full or blocked: the ad still plays, the rotation just won't advance.
    }
  }

  function pickStorage() {
    try {
      var key = "adRotator:probe";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return window.localStorage;
    } catch (e) {
      storageError = (e && (e.name || e.message)) || "blocked";
      return null;
    }
  }

  // Diagnostics for the debug box, stored under fixed keys (not tied to the page path) so
  // they show whether this screen reloads the page each loop and keeps the same path.
  function recordLoad() {
    var info = { loads: 1, samePath: "first load" };
    if (!storage) {
      return info;
    }
    try {
      var loads = parseInt(storage.getItem("adRotator:diag:loads"), 10) || 0;
      var lastPath = storage.getItem("adRotator:diag:path");
      info.loads = loads + 1;
      if (lastPath !== null) {
        info.samePath = lastPath === window.location.pathname ? "yes" : "NO, path changed";
      }
      storage.setItem("adRotator:diag:loads", String(info.loads));
      storage.setItem("adRotator:diag:path", window.location.pathname);
    } catch (e) {
      // Diagnostics only.
    }
    return info;
  }

  function isFramed() {
    try {
      return window.top !== window ? "yes" : "no";
    } catch (e) {
      return "yes (cross-origin)";
    }
  }

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function debugOn() {
    return params.debug === "1" || settings.debug === true;
  }

  function showDebug() {
    if (!debugOn()) {
      return;
    }
    var state = readState();
    var openFor = Math.round((now() - pageOpenedAt) / 1000);
    debugBox.textContent = [
      "Ad Rotator " + VERSION,
      "playing: " + (current ? current.src : "none"),
      "started from: " + startedFrom,
      "on screen after: " + (shownAfter === null ? "..." : shownAfter + " ms"),
      "next: ad " + state.next + (state.src ? " (" + state.src + ", ready)" : " (looking...)"),
      "storage: " + (storage ? "localStorage OK" : "UNAVAILABLE (" + storageError + "), always ad 1"),
      "page loads on this screen: " + diag.loads,
      "same path as last load: " + diag.samePath,
      "page open for: " + openFor + " s, visibility changes: " + visibilityChanges,
      "in a frame: " + isFramed() + ", player object: " + (window.easysignage ? "yes" : "no"),
      "path: " + window.location.pathname,
      "browser: " + navigator.userAgent,
    ].join("\n");
    debugBox.style.display = "block";
  }

  function parseQuery(search) {
    var out = {};
    (search || "").replace(/^\?/, "").split("&").forEach(function (pair) {
      if (!pair) {
        return;
      }
      var parts = pair.split("=");
      out[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || "");
    });
    return out;
  }
})();
