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
  var listOpen = false;

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
    els.eventList = document.getElementById("event-list");
    els.eventListItems = document.getElementById("event-list-items");
    els.listToggle = document.getElementById("list-toggle");
    els.listCount = document.getElementById("list-count");

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
    els.listToggle.addEventListener("click", toggleEventList);
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
        var eventArr = Array.isArray(events) ? events : [];
        renderEvents(eventArr);
        renderEventList(eventArr);
      })
      .catch(function (err) {
        console.error("Happening: failed to load events", err);
        renderEvents([]);
        renderEventList([]);
      });
  }

  // ----------------------------------------------------------
  // Pins
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Event List (calendar sidebar)
  // ----------------------------------------------------------

  function renderEventList(events) {
    els.eventListItems.innerHTML = "";

    var today = startOfDay(new Date());

    var upcoming = events.filter(function (e) {
      var end = parseDate(e.dates && e.dates.end);
      return end && end >= today;
    }).sort(function (a, b) {
      return parseDate(a.dates.start) - parseDate(b.dates.start);
    });

    var past = events.filter(function (e) {
      var end = parseDate(e.dates && e.dates.end);
      return end && end < today;
    }).sort(function (a, b) {
      return parseDate(b.dates.start) - parseDate(a.dates.start);
    });

    els.listCount.textContent = upcoming.length;

    upcoming.forEach(function (event) {
      els.eventListItems.appendChild(createListItem(event));
    });

    if (past.length) {
      var divider = document.createElement("div");
      divider.className = "event-list__divider";
      divider.textContent = "Past";
      els.eventListItems.appendChild(divider);

      past.forEach(function (event) {
        els.eventListItems.appendChild(createListItem(event));
      });
    }

    // Show list by default on desktop
    if (window.innerWidth > 640) {
      els.eventList.classList.add("is-open");
      listOpen = true;
    }
  }

  function createListItem(event) {
    var status = getEventStatus(event);

    var item = document.createElement("button");
    item.className = "event-list-item event-list-item--" + status;

    var dot = document.createElement("span");
    dot.className = "event-list-item__dot dot--" + status;

    var info = document.createElement("div");
    info.className = "event-list-item__info";

    var name = document.createElement("span");
    name.className = "event-list-item__name";
    name.textContent = event.name || "Untitled";

    var meta = document.createElement("span");
    meta.className = "event-list-item__meta";

    var dateStr = formatDateRange(
      event.dates && event.dates.start,
      event.dates && event.dates.end
    );
    var daysLabel = getDaysLabel(event);
    meta.textContent = dateStr + (daysLabel ? "  ·  " + daysLabel : "");

    var typeTag = document.createElement("span");
    typeTag.className = "event-list-item__type type-" + slugifyType(event.type);
    typeTag.textContent = event.type || "Other";

    var arrow = document.createElement("span");
    arrow.className = "event-list-item__arrow";
    arrow.textContent = "→";

    info.appendChild(name);
    info.appendChild(meta);
    info.appendChild(typeTag);

    item.appendChild(dot);
    item.appendChild(info);
    item.appendChild(arrow);

    item.addEventListener("click", function () {
      if (event.lat && event.lng) {
        map.setView([event.lat, event.lng], 14, { animate: true });
      }
      openSidebar(event);

      // Close list on mobile
      if (window.innerWidth <= 640) {
        els.eventList.classList.remove("is-open");
        listOpen = false;
      }
    });

    return item;
  }

  function getDaysLabel(event) {
    var today = startOfDay(new Date());
    var start = parseDate(event.dates && event.dates.start);
    var end = parseDate(event.dates && event.dates.end);

    if (!start || !end) return "";

    if (today >= start && today <= end) return "Happening now";
    if (today > end) return "Ended";

    var days = Math.round((start - today) / DAY_MS);
    if (days === 1) return "Tomorrow";
    if (days <= 7) return "In " + days + " days";
    if (days <= 14) return "Next week";
    return "";
  }

  function toggleEventList() {
    listOpen = !listOpen;
    if (listOpen) {
      els.eventList.classList.add("is-open");
    } else {
      els.eventList.classList.remove("is-open");
    }
  }

  // ----------------------------------------------------------
  // Sidebar (event detail)
  // ----------------------------------------------------------

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
