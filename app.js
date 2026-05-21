// Register Progressive Web App (PWA) Service Worker for Native App Installation
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(reg => console.log("PWA Service Worker activated:", reg.scope))
      .catch(err => console.error("PWA Service Worker registration failed:", err));
  });
}

// Application State Manager for Redesigned Sarkari Portal
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initial State
  let state = {
    activeCategory: "all",
    searchQuery: "",
    activeFilter: "all", // "all", "central", "state"
    sortBy: "newest", // "newest", "alphabetical", "deadline"
    selectedItemId: null,
    watchlistedItems: JSON.parse(localStorage.getItem("sarkari_watchlist")) || [],
    theme: "light"
  };

  // 2. DOM Elements
  const searchInput = document.getElementById("search-input");
  const navLinks = document.querySelectorAll(".nav-link");
  const pillBtns = document.querySelectorAll(".pill-btn");
  const sortSelect = document.getElementById("sort-select");
  const listingsGrid = document.getElementById("listings-grid");
  const watchlistCount = document.getElementById("watchlist-count");
  
  // Stats Elements
  const statActiveJobs = document.getElementById("stat-active-jobs");
  const statResults = document.getElementById("stat-results");
  const statAdmitCards = document.getElementById("stat-admit-cards");

  // Drawer Elements
  const drawer = document.getElementById("detail-drawer");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const drawerClose = document.getElementById("drawer-close");
  const drawerTitle = document.getElementById("drawer-title");
  const drawerOrg = document.getElementById("drawer-org");
  const drawerLevelBadge = document.getElementById("drawer-level-badge");
  const drawerVacancy = document.getElementById("drawer-vacancy");
  const drawerLastDate = document.getElementById("drawer-last-date");
  const drawerApplyStart = document.getElementById("drawer-apply-start");
  const drawerExamDate = document.getElementById("drawer-exam-date");
  const drawerFeeGen = document.getElementById("drawer-fee-gen");
  const drawerFeeSc = document.getElementById("drawer-fee-sc");
  const drawerAge = document.getElementById("drawer-age");
  const drawerEligibility = document.getElementById("drawer-eligibility");
  const drawerTags = document.getElementById("drawer-tags");
  const btnApplyOnline = document.getElementById("btn-apply-online");
  const btnDownloadNotification = document.getElementById("btn-download-notification");
  const btnDrawerBookmark = document.getElementById("btn-drawer-bookmark");
  const btnDrawerCopy = document.getElementById("btn-drawer-copy");

  // Ticker marquee elements
  const tickerMarquee = document.getElementById("ticker-marquee");

  // 3. Initialize Theme
  applyTheme();

  // 4. Initialize Data & Render
  initTicker();
  updateStats();
  renderListings();

  // 5. Event Listeners

  // Search Input
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderListings();
  });

  // Sidebar Category Links
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Update active style
      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      // Update state
      state.activeCategory = link.dataset.category;
      renderListings();
    });
  });

  // Level Quick Filters (All, Central, State)
  pillBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      pillBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeFilter = btn.dataset.filter;
      renderListings();
    });
  });

  // Sorting
  sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderListings();
  });



  // Drawer Close
  drawerClose.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  // Keyboard navigation for drawer (ESC key)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // Drawer Bookmark Button
  btnDrawerBookmark.addEventListener("click", () => {
    if (state.selectedItemId) {
      toggleWatchlist(state.selectedItemId);
      updateDrawerBookmarkButton(state.selectedItemId);
    }
  });

  // Drawer Copy Button
  if (btnDrawerCopy) {
    btnDrawerCopy.addEventListener("click", () => {
      const url = btnDrawerCopy.dataset.url;
      if (url) {
        navigator.clipboard.writeText(url)
          .then(() => {
            const originalHTML = btnDrawerCopy.innerHTML;
            btnDrawerCopy.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:20px;height:20px;color:var(--accent-cyan);">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            `;
            btnDrawerCopy.style.borderColor = "var(--accent-cyan)";
            btnDrawerCopy.style.background = "rgba(6, 182, 212, 0.15)";
            setTimeout(() => {
              btnDrawerCopy.innerHTML = originalHTML;
              btnDrawerCopy.style.borderColor = "";
              btnDrawerCopy.style.background = "";
            }, 1500);
          })
          .catch(err => {
            console.error("Clipboard copy failed: ", err);
          });
      }
    });
  }

  // 6. Functions

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("sarkari_theme", "light");
  }

  // Populate dynamic marquee scrolling items
  function initTicker() {
    const trending = PORTAL_DATA.filter(item => item.category === "latest-job" || item.category === "admit-card").slice(0, 6);
    let html = "";
    
    // Duplicate twice for seamless loop scrolling
    for (let i = 0; i < 2; i++) {
      trending.forEach(item => {
        html += `
          <a href="#" class="ticker-item" data-id="${item.id}">
            <div class="ticker-dot"></div>
            <span>${item.title.split("Online Form")[0].split("Admit Card")[0]}</span>
          </a>
        `;
      });
    }
    
    tickerMarquee.innerHTML = html;
    
    // Bind click events inside marquee
    tickerMarquee.querySelectorAll(".ticker-item").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        openDrawer(el.dataset.id);
      });
    });
  }

  // Calculate high-level stats cards
  function updateStats() {
    const activeJobsCount = PORTAL_DATA.filter(item => item.category === "latest-job").length;
    const resultsCount = PORTAL_DATA.filter(item => item.category === "result").length;
    const admitCardsCount = PORTAL_DATA.filter(item => item.category === "admit-card").length;

    statActiveJobs.textContent = activeJobsCount;
    statResults.textContent = resultsCount;
    statAdmitCards.textContent = admitCardsCount;

    // Update categories counters in Sidebar
    navLinks.forEach(link => {
      const cat = link.dataset.category;
      const countSpan = link.querySelector(".nav-count");
      if (countSpan) {
        if (cat === "all") {
          countSpan.textContent = PORTAL_DATA.length;
        } else if (cat === "watchlist") {
          countSpan.textContent = state.watchlistedItems.length;
        } else {
          countSpan.textContent = PORTAL_DATA.filter(item => item.category === cat).length;
        }
      }
    });

    // Update Watchlist top badge
    if (state.watchlistedItems.length > 0) {
      watchlistCount.textContent = state.watchlistedItems.length;
      watchlistCount.style.display = "flex";
    } else {
      watchlistCount.style.display = "none";
    }
  }

  // Primary filtering and sorting engine
  function renderListings() {
    listingsGrid.innerHTML = "";

    // A. Filter by Category
    let filtered = PORTAL_DATA;
    if (state.activeCategory === "watchlist") {
      filtered = PORTAL_DATA.filter(item => state.watchlistedItems.includes(item.id));
    } else if (state.activeCategory !== "all") {
      filtered = PORTAL_DATA.filter(item => item.category === state.activeCategory);
    }

    // B. Filter by level (Central vs State)
    if (state.activeFilter !== "all") {
      filtered = filtered.filter(item => item.level.toLowerCase() === state.activeFilter);
    }

    // C. Filter by search query
    if (state.searchQuery) {
      filtered = filtered.filter(item => {
        return (
          item.title.toLowerCase().includes(state.searchQuery) ||
          item.organization.toLowerCase().includes(state.searchQuery) ||
          item.state.toLowerCase().includes(state.searchQuery) ||
          item.tags.some(tag => tag.toLowerCase().includes(state.searchQuery))
        );
      });
    }

    // D. Sort listings
    filtered.sort((a, b) => {
      if (state.sortBy === "newest") {
        const dateDiff = new Date(b.dateAdded) - new Date(a.dateAdded);
        if (dateDiff !== 0) return dateDiff;
        
        // Tie-breaker: prioritize 'latest-job' and 'admission' at the top
        const categoryPriority = {
          "latest-job": 1,
          "admission": 2,
          "important": 3,
          "admit-card": 4,
          "result": 5,
          "answer-key": 6,
          "syllabus": 7
        };
        const priorityA = categoryPriority[a.category] || 99;
        const priorityB = categoryPriority[b.category] || 99;
        return priorityA - priorityB;
      }
      if (state.sortBy === "alphabetical") {
        return a.title.localeCompare(b.title);
      }
      if (state.sortBy === "deadline") {
        // Handle N/A or Ongoing deadlines pushing them to the end
        const aDate = (a.lastDate === "Ongoing" || a.lastDate === "N/A" || a.lastDate === "Continuous") ? "2099-12-31" : a.lastDate;
        const bDate = (b.lastDate === "Ongoing" || b.lastDate === "N/A" || b.lastDate === "Continuous") ? "2099-12-31" : b.lastDate;
        return new Date(aDate) - new Date(bDate);
      }
      return 0;
    });

    // E. Handle Empty State
    if (filtered.length === 0) {
      listingsGrid.innerHTML = `
        <div class="empty-state glass">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3>No Listings Found</h3>
          <p>We couldn't find any announcements matching your search query or selected criteria. Try adjusting your filters or query.</p>
        </div>
      `;
      return;
    }

    // F. Render Grid Items
    filtered.forEach((item, index) => {
      const isBookmarked = state.watchlistedItems.includes(item.id);
      const card = document.createElement("div");
      card.className = "listing-card glass";
      card.dataset.id = item.id;
      card.style.setProperty("--card-index", index);

      // Handle Category Label Color
      const badgeClass = `badge-${item.category}`;
      const prettyCategory = item.category.replace("-", " ");

      // Check if deadline is close or passed
      let isUrgent = false;
      let isClosed = false;
      let deadlineLabel = item.lastDate;
      
      if (item.lastDate && item.lastDate !== "N/A" && item.lastDate !== "Ongoing" && item.lastDate !== "Continuous") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(item.lastDate);
        
        if (isNaN(deadlineDate.getTime())) {
          // Keep format as is if unknown date type
        } else if (deadlineDate < today) {
          isClosed = true;
          deadlineLabel = `${item.lastDate} (Expired)`;
        } else {
          const diffTime = deadlineDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 0 && diffDays <= 7) {
            isUrgent = true;
            deadlineLabel = `${item.lastDate} (Closes in ${diffDays}d!)`;
          }
        }
      }

      let statusText = "Updated";
      if (item.category === 'latest-job' || item.category === 'admission') {
        statusText = isClosed ? 'Applications Closed' : 'Applications Open';
      } else {
        statusText = isClosed ? 'Closed' : 'Updated';
      }

      card.innerHTML = `
        <div class="listing-card-header">
          <span class="badge ${badgeClass}">${prettyCategory}</span>
          <span class="org-tag">${item.organization}</span>
          <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${item.id}" title="Add to Watchlist">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
        </div>
        <h3 class="listing-card-title">${item.title}</h3>
        <div class="listing-card-details">
          <div class="detail-row">
            <span class="detail-label">Region</span>
            <span class="detail-val">${item.state} (${item.level})</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Vacancies</span>
            <span class="detail-val">${item.vacancies}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Last Date</span>
            <span class="detail-val ${isUrgent || isClosed ? 'danger' : ''}">${deadlineLabel}</span>
          </div>
        </div>
        <div class="card-action-bar">
          <div class="pulse-indicator ${isClosed ? 'closed' : ''}">
            <div class="pulse-dot"></div>
            <span>${statusText}</span>
          </div>
          <a href="#" class="card-link">
            <span>Details</span>
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.25 4.5l7.5 7.5-7.5 7.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </a>
        </div>
      `;

      // Event listener for opening detail drawer
      card.addEventListener("click", (e) => {
        // Prevent trigger if clicking bookmark button
        if (e.target.closest(".bookmark-btn")) return;
        e.preventDefault();
        openDrawer(item.id);
      });

      // Event listener for bookmark icon
      card.querySelector(".bookmark-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleWatchlist(item.id);
        e.currentTarget.classList.toggle("active");
      });

      listingsGrid.appendChild(card);
    });
  }

  // Slide out drawer content controller
  function openDrawer(id) {
    const item = PORTAL_DATA.find(i => i.id === id);
    if (!item) return;

    state.selectedItemId = id;

    // Populate drawer elements
    drawerTitle.textContent = item.title;
    drawerOrg.textContent = `${item.organization} Portal`;
    drawerLevelBadge.textContent = `${item.level} / ${item.state}`;
    drawerLevelBadge.className = `badge badge-${item.category}`;
    drawerVacancy.textContent = item.vacancies;
    
    // Check if expired
    let drawerIsClosed = false;
    if (item.lastDate && item.lastDate !== "N/A" && item.lastDate !== "Ongoing" && item.lastDate !== "Continuous") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(item.lastDate);
      if (!isNaN(deadlineDate.getTime()) && deadlineDate < today) {
        drawerIsClosed = true;
      }
    }

    // Deadlines formatting
    if (drawerIsClosed) {
      drawerLastDate.textContent = `${item.lastDate} (Expired)`;
      drawerLastDate.className = "drawer-text danger";
    } else {
      drawerLastDate.textContent = item.lastDate;
      drawerLastDate.className = "drawer-text";
    }
    drawerApplyStart.textContent = item.importantDates.applyStart;
    drawerExamDate.textContent = item.importantDates.examTier1;
    
    // Fee Structure
    drawerFeeGen.textContent = item.fee.gen_obc || "N/A";
    drawerFeeSc.textContent = item.fee.sc_st_ph || "N/A";
    
    // Age and Qualifications
    drawerAge.textContent = item.ageLimit;
    drawerEligibility.textContent = item.eligibility;

    // Action button targets & labels
    btnApplyOnline.href = item.applyLink;
    btnDownloadNotification.href = item.notificationLink;
    if (btnDrawerCopy) {
      btnDrawerCopy.dataset.url = item.applyLink || "";
    }

    // Dynamically update primary action button label based on category and status
    if (drawerIsClosed) {
      btnApplyOnline.textContent = "Application Closed";
      btnApplyOnline.style.opacity = "0.5";
      btnApplyOnline.style.pointerEvents = "none";
      btnApplyOnline.style.background = "var(--text-muted)";
    } else {
      btnApplyOnline.style.opacity = "";
      btnApplyOnline.style.pointerEvents = "";
      btnApplyOnline.style.background = "";
      
      if (item.category === "result") {
        btnApplyOnline.textContent = "Download Result";
      } else if (item.category === "admit-card") {
        btnApplyOnline.textContent = "Download Admit Card";
      } else if (item.category === "answer-key") {
        btnApplyOnline.textContent = "Download Answer Key";
      } else if (item.category === "syllabus") {
        btnApplyOnline.textContent = "Download Syllabus";
      } else {
        btnApplyOnline.textContent = "Apply Online";
      }
    }

    // Toggle secondary official document PDF button visibility
    if (item.notificationLink && item.notificationLink !== item.detailUrl) {
      btnDownloadNotification.style.display = "inline-flex";
    } else {
      btnDownloadNotification.style.display = "none";
    }

    // Tags list
    drawerTags.innerHTML = "";
    item.tags.forEach(tag => {
      const tagSpan = document.createElement("span");
      tagSpan.className = "org-tag";
      tagSpan.style.fontSize = "0.75rem";
      tagSpan.textContent = tag;
      drawerTags.appendChild(tagSpan);
    });

    updateDrawerBookmarkButton(id);

    // Open animations
    drawer.classList.add("open");
    drawerOverlay.classList.add("open");
    document.body.style.overflow = "hidden"; // Disable background scrolling
  }

  function closeDrawer() {
    state.selectedItemId = null;
    drawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
    document.body.style.overflow = ""; // Enable background scrolling
  }

  function toggleWatchlist(id) {
    const index = state.watchlistedItems.indexOf(id);
    if (index > -1) {
      state.watchlistedItems.splice(index, 1);
    } else {
      state.watchlistedItems.push(id);
    }

    localStorage.setItem("sarkari_watchlist", JSON.stringify(state.watchlistedItems));
    updateStats();

    // If we're looking at the watchlist tab, re-render immediately to remove unfavorited card
    if (state.activeCategory === "watchlist") {
      renderListings();
    }
  }

  function updateDrawerBookmarkButton(id) {
    const isBookmarked = state.watchlistedItems.includes(id);
    if (isBookmarked) {
      btnDrawerBookmark.innerHTML = `
        <svg style="width:20px;height:20px;fill:currentColor;margin-right:8px;" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
        <span>Watchlisted</span>
      `;
      btnDrawerBookmark.style.background = "rgba(168, 85, 247, 0.15)";
      btnDrawerBookmark.style.color = "var(--accent-purple)";
      btnDrawerBookmark.style.borderColor = "var(--accent-purple)";
    } else {
      btnDrawerBookmark.innerHTML = `
        <svg style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;margin-right:8px;" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
        <span>Add Watchlist</span>
      `;
      btnDrawerBookmark.style.background = "rgba(255, 255, 255, 0.05)";
      btnDrawerBookmark.style.color = "var(--text-primary)";
      btnDrawerBookmark.style.borderColor = "var(--border-glass)";
    }
  }

  // 10. Floating PWA Custom Install Prompt Banner Controller
  let deferredPrompt;
  const installBanner = document.getElementById("install-banner");
  const installBtn = document.getElementById("install-btn");
  const installCloseBtn = document.getElementById("install-close-btn");

  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent the default browser mini-infobar from showing
    e.preventDefault();
    // Stash the event so we can trigger it upon clicking
    deferredPrompt = e;
    // Show the custom premium PWA install banner
    if (installBanner) {
      installBanner.style.display = "flex";
    }
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      // Show the native browser install dialog
      deferredPrompt.prompt();
      // Inspect the user's action
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA Installation outcome: ${outcome}`);
      deferredPrompt = null;
      // Hide the banner
      if (installBanner) {
        installBanner.style.display = "none";
      }
    });
  }

  if (installCloseBtn) {
    installCloseBtn.addEventListener("click", () => {
      // Hide the banner if the user clicks 'Later'
      if (installBanner) {
        installBanner.style.display = "none";
      }
    });
  }

  window.addEventListener("appinstalled", (evt) => {
    console.log("App was successfully installed onto device app drawer!");
    if (installBanner) {
      installBanner.style.display = "none";
    }
  });
});
