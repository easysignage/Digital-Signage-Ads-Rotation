// Ad Rotator: plays one ad per playlist loop and moves to the next ad on the next loop.
//
// Ads live in ../ads and are named by play order: 01.jpg, 02.mp4, 03.png, ... (1.jpg and
// 001.jpg work too).
// A page opened from local files cannot list a folder, so the app looks for the ad
// numbered by its counter, trying each supported extension. When that number is
// missing, the rotation has passed the last ad and starts again at 1.
//
// The player opens index.html each time the playlist reaches this item, so the counter
// lives in localStorage. If a player keeps the page open between loops, the page moves
// on when it becomes visible again after being hidden.
//
// URL options for testing: ?debug=1 shows the current state, ?reset=1 starts at ad 1.
(function () {
  "use strict";

  var IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "svg"];
  var VIDEO_EXT = ["mp4", "webm", "mov", "m4v"];
  var PROBE_TIMEOUT_MS = 8000;

  var settings = window.AD_ROTATOR_SETTINGS || {};
  var stage = document.getElementById("stage");
  var messageBox = document.getElementById("message");
  var debugBox = document.getElementById("debug");
  var params = parseQuery(window.location.search);
  // Keyed by the page's own path so two rotators on one screen keep separate places.
  var storageKey = "adRotator:" + window.location.pathname;
  var storage = pickStorage();
  var current = null;
  var wasHidden = false;
  var busy = false;

  document.body.style.background = settings.background || "#000";

  if (params.reset === "1") {
    writeNext(1);
  }

  playNext();

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      wasHidden = true;
      pauseVideo();
    } else if (wasHidden) {
      wasHidden = false;
      playNext();
    }
  });

  function playNext() {
    if (busy) {
      return;
    }
    busy = true;
    var wanted = readNext();
    findAd(wanted, function (ad) {
      if (!ad && wanted !== 1) {
        // Past the last ad: start again from the first.
        wanted = 1;
        findAd(1, done);
        return;
      }
      done(ad);
    });

    function done(ad) {
      busy = false;
      if (!ad) {
        showMessage("Add your ads to the \"ads\" folder, named 01, 02, 03 and so on.");
        return;
      }
      writeNext(wanted + 1);
      show(ad);
    }
  }

  // Looks for ad number n under every name it may have (1, 01, 001) and every supported
  // extension at once, then returns the first match in list order, so a stray duplicate
  // (01.jpg and 01.png) resolves predictably.
  function findAd(n, callback) {
    var candidates = [];
    numberNames(n).forEach(function (name) {
      IMAGE_EXT.forEach(function (ext) {
        candidates.push({ src: "ads/" + name + "." + ext, video: false });
        candidates.push({ src: "ads/" + name + "." + ext.toUpperCase(), video: false });
      });
      VIDEO_EXT.forEach(function (ext) {
        candidates.push({ src: "ads/" + name + "." + ext, video: true });
        candidates.push({ src: "ads/" + name + "." + ext.toUpperCase(), video: true });
      });
    });

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

  function show(ad) {
    current = ad;
    var fit = settings.fit === "cover" ? "cover" : "contain";
    var el;

    if (ad.video) {
      el = document.createElement("video");
      el.muted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute("muted", "");
      el.setAttribute("playsinline", "");
      el.loop = settings.videoEnd === "loop";
    } else {
      el = document.createElement("img");
      el.alt = "";
    }
    el.style.objectFit = fit;
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
  }

  function showMessage(text) {
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

  function readNext() {
    if (!storage) {
      return 1;
    }
    try {
      var value = parseInt(storage.getItem(storageKey), 10);
      return isNaN(value) || value < 1 ? 1 : value;
    } catch (e) {
      return 1;
    }
  }

  function writeNext(value) {
    if (!storage) {
      return;
    }
    try {
      storage.setItem(storageKey, String(value));
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
      return null;
    }
  }

  function showDebug() {
    if (params.debug !== "1") {
      return;
    }
    debugBox.textContent = [
      "Ad Rotator",
      "playing: " + (current ? current.src : "none"),
      "storage: " + (storage ? "localStorage" : "unavailable, always ad 1"),
      "next try: ad " + readNext(),
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
