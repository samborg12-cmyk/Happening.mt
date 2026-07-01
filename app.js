// ============================================================
// Happening — app.js
// Plain JS, Leaflet, no build step.
// ============================================================

(function () {
  "use strict";

  var DAY_MS = 24 * 60 * 60 * 1000;
  var SOON_WINDOW_DAYS = 14;

  var MALTA_CENTER = [35.9375, 14.3754];
  var DEFAULT_ZOOM = 11;

  var map;
  var markers = [];
  var activeMarker = null;

  var els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    initMap();
    bindGlobalEvents();
    loadEvents();
  }

  function cacheElements() {
    els.overlay = document.getElementById("overlay");
    els.sidebar = document.getElementById("sidebar");
    els.sidebarClose = document.getElementById("sidebar-close");

    els.sbName = document.getElementById("sb-name");
    els.sbType = document.getElementById("sb-type");
    els.sbDates = document.getElementById("sb-dates");
    els.sbEditorScore = document.getElementById("sb-editor-score");
    els.sbHypeScore = document.getElementById("sb-hype-score");
    els.sbDescription = document.getElementById("sb-description");
    els.sbPrice = document.getElementById("sb-price");
    els.sbTransport = document.getElementById("sb-transport");
    els.sbExtras = document.getElementById("sb-extras");
    els.sbPhotosSection = document.getElementById("sb-photos-section");
    els.sbPhotos = document.getElementById("sb-photos");
  }

  function initMap() {
    map = L.map("map", {
      zoomControl: true,
    }).setView(MALTA_CENTER, DEFAULT_ZOOM);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    map.on("click", closeSidebar);
  }

  function bindGlobalEvents() {
    els.sidebarClose.addEventListener("click", closeSidebar);
    els.overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSidebar();
    });
  }

  function loadEvents() {
    fetch("events.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load events.json");
        return res.json();
      })
      .then(function (events) {
        renderEvents(Array.isArray(events) ? events : []);
      })
      .catch(function (err) {
        console.error("Happening: failed to load events", err);
        renderEvents([]);
      });
  }

  function renderEvents(events) {
    events.forEach(function (event) {
      addPin(event);
    });
  }

  function addPin(event) {
    if (typeof event.lat !== "number" || typeof event.lng !== "number") return;

    var status = getEventStatus(event);
    var icon = L.divIcon({
      className: "",
      html: '<div class="pin pin--' + status + '"></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    var marker = L.marker([event.lat, event.lng], { icon: icon }).addTo(map);

    marker.on("click", function (e) {
      L.DomEvent.stopPropagation(e);
      openSidebar(event);
    });

    markers.push(marker);
  }

  function getEventStatus(event) {
    var today = startOfDay(new Date());
    var start = parseDate(event.dates && event.dates.start);
    var end = parseDate(event.dates && event.dates.end);

    if (!start || !end) return "future";

    if (today >= start && today <= end) return "today";
    if (today > end) return "past";

    var daysUntilStart = Math.round((start - today) / DAY_MS);
    if (daysUntilStart <= SOON_WINDOW_DAYS) return "soon";

    return "future";
  }

  function parseDate(str) {
    if (!str) return null;
    var parts = str.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function openSidebar(event) {
    els.sbName.textContent = event.name || "Untitled event";

    var typeSlug = slugifyType(event.type);
    els.sbType.textContent = event.type || "Other";
    els.sbType.className = "badge badge--type type-" + typeSlug;

    els.sbDates.textContent = formatDateRange(
      event.dates && event.dates.start,
      event.dates && event.dates.end
    );

    setScore(els.sbEditorScore, event.editorScore);
    setScore(els.sbHypeScore, event.hypeScore);

    els.sbDescription.textContent = event.description || "";
    els.sbPrice.textContent = event.price || "Not specified";
    els.sbTransport.textContent = event.transport || "Not specified";
    els.sbExtras.textContent = event.extras || "Not specified";

    renderPhotos(event.photos);

    els.sidebar.classList.add("is-open");
    els.sidebar.setAttribute("aria-hidden", "false");
    els.overlay.classList.add("is-active");
    activeMarker = event.id;
  }

  function closeSidebar() {
    els.sidebar.classList.remove("is-open");
    els.sidebar.setAttribute("aria-hidden", "true");
    els.overlay.classList.remove("is-active");
    activeMarker = null;
  }

  function renderPhotos(photos) {
    els.sbPhotos.innerHTML = "";
    if (!photos || !photos.length) {
      els.sbPhotosSection.hidden = true;
      return;
    }
    els.sbPhotosSection.hidden = false;
    photos.forEach(function (url) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = "Event photo";
      img.loading = "lazy";
      els.sbPhotos.appendChild(img);
    });
  }

  function setScore(el, score) {
    el.textContent = score || "—";
    el.className = "score-card__value " + scoreColorClass(score);
  }

  function scoreColorClass(score) {
    if (!score) return "";
    var letter = score.charAt(0).toUpperCase();
    switch (letter) {
      case "D":
        return "score--red";
      case "C":
        return "score--orange";
      case "B":
        return "score--blue";
      case "A":
        return "score--green";
      default:
        return "";
    }
  }

  function slugifyType(type) {
    if (!type) return "other";
    return type.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function formatDateRange(startStr, endStr) {
    var start = parseDate(startStr);
    var end = parseDate(endStr);
    if (!start || !end) return "";

    var monthDay = { month: "short", day: "numeric" };
    var startLabel = start.toLocaleDateString("en-US", monthDay);
    var endLabel = end.toLocaleDateString("en-US", monthDay);
    var year = end.getFullYear();

    if (start.getTime() === end.getTime()) {
      return startLabel + ", " + year;
    }
    return startLabel + " – " + endLabel + ", " + year;
  }
})();

