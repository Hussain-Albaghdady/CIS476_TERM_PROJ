document.addEventListener("DOMContentLoaded", function () {
  if (window.location.pathname.endsWith("vehicle-reservation.html")) {
    fetch("/api/userinfo")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.name) {
          var cardholderField = document.getElementById(
            "payment_cardholder_name",
          );
          if (cardholderField) cardholderField.value = data.name;
        }
      });
  }
});
!(function ($) {
  "use strict";

  $(window).scroll(function () {
    if ($(this).scrollTop() > 100) {
      $("#header").addClass("header-scrolled");
    } else {
      $("#header").removeClass("header-scrolled");
    }
  });

  if ($(window).scrollTop() > 100) {
    $("#header").addClass("header-scrolled");
  }

  $("#header").sticky({
    topSpacing: 0,
    zIndex: "50",
  });

  var scrolltoOffset = $("#header").outerHeight() - 2;
  $(document).on(
    "click",
    ".nav-menu a, .mobile-nav a, .scrollto",
    function (e) {
      if (
        location.pathname.replace(/^\//, "") ==
          this.pathname.replace(/^\//, "") &&
        location.hostname == this.hostname
      ) {
        var target = $(this.hash);
        if (target.length) {
          e.preventDefault();

          var scrollto = target.offset().top - scrolltoOffset;

          if ($(this).attr("href") == "#header") {
            scrollto = 0;
          }

          $("html, body").animate(
            {
              scrollTop: scrollto,
            },
            1500,
            "easeInOutExpo",
          );

          if ($(this).parents(".nav-menu, .mobile-nav").length) {
            $(".nav-menu .active, .mobile-nav .active").removeClass("active");
            $(this).closest("li").addClass("active");
          }

          if ($("body").hasClass("mobile-nav-active")) {
            $("body").removeClass("mobile-nav-active");
            $(".mobile-nav-toggle i").toggleClass(
              "icofont-navigation-menu icofont-close",
            );
            $(".mobile-nav-overly").fadeOut();
          }
          return false;
        }
      }
    },
  );

  $(document).ready(function () {
    if (window.location.hash) {
      var initial_nav = window.location.hash;
      if ($(initial_nav).length) {
        var scrollto = $(initial_nav).offset().top - scrolltoOffset;
        $("html, body").animate(
          {
            scrollTop: scrollto,
          },
          1500,
          "easeInOutExpo",
        );
      }
    }
  });

  if ($(".nav-menu").length) {
    var $mobile_nav = $(".nav-menu").clone().prop({
      class: "mobile-nav d-lg-none",
    });
    $("body").append($mobile_nav);
    $("body").prepend(
      '<button type="button" class="mobile-nav-toggle d-lg-none"><i class="icofont-navigation-menu"></i></button>',
    );
    $("body").append('<div class="mobile-nav-overly"></div>');

    $(document).on("click", ".mobile-nav-toggle", function () {
      $("body").toggleClass("mobile-nav-active");
      $(".mobile-nav-toggle i").toggleClass(
        "icofont-navigation-menu icofont-close",
      );
      $(".mobile-nav-overly").toggle();
    });

    $(document).on("click", ".mobile-nav .drop-down > a", function (e) {
      e.preventDefault();
      $(this).next().slideToggle(300);
      $(this).parent().toggleClass("active");
    });

    $(document).click(function (e) {
      var container = $(".mobile-nav, .mobile-nav-toggle");
      if (!container.is(e.target) && container.has(e.target).length === 0) {
        if ($("body").hasClass("mobile-nav-active")) {
          $("body").removeClass("mobile-nav-active");
          $(".mobile-nav-toggle i").toggleClass(
            "icofont-navigation-menu icofont-close",
          );
          $(".mobile-nav-overly").fadeOut();
        }
      }
    });
  } else if ($(".mobile-nav, .mobile-nav-toggle").length) {
    $(".mobile-nav, .mobile-nav-toggle").hide();
  }
  function markRouteActive() {
    const path = location.pathname.split("/").pop() || "index.html";
    const lists = document.querySelectorAll(".nav-menu, .mobile-nav ul");
    lists.forEach((list) => {
      if (!list) return;
      list
        .querySelectorAll(".route-active")
        .forEach((li) => li.classList.remove("route-active", "active"));
      list.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        const file = href.split("/").pop();
        if (file === path) {
          a.closest("li")?.classList.add("route-active", "active");
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", markRouteActive);

  var nav_sections = $("section");
  var main_nav = $(".nav-menu, .mobile-nav");

  $(window).on("scroll", function () {
    if (nav_sections.length === 0) return;

    var cur_pos = $(this).scrollTop() + 200;

    main_nav.find('a[href^="#"]').parent("li").removeClass("active");

    nav_sections.each(function () {
      var top = $(this).offset().top,
        bottom = top + $(this).outerHeight();

      if (cur_pos >= top && cur_pos <= bottom) {
        main_nav
          .find('a[href="#' + $(this).attr("id") + '"]')
          .parent("li")
          .addClass("active");
      }
    });
  });

  $(window).scroll(function () {
    if ($(this).scrollTop() > 100) {
      $(".back-to-top").fadeIn("slow");
    } else {
      $(".back-to-top").fadeOut("slow");
    }
  });

  $(".back-to-top").click(function () {
    $("html, body").animate(
      {
        scrollTop: 0,
      },
      1500,
      "easeInOutExpo",
    );
    return false;
  });

  $(window).on("load", function () {
    $(".venobox").venobox();
  });

  $('[data-toggle="counter-up"]').counterUp({
    delay: 10,
    time: 1000,
  });

  $(".event-details-carousel").owlCarousel({
    autoplay: true,
    dots: true,
    loop: true,
    items: 1,
  });

  function aos_init() {
    AOS.init({
      duration: 1000,
      easing: "ease-in-out-back",
      once: true,
    });
  }
  $(window).on("load", function () {
    aos_init();
  });
  var $grid = $(".event-container").isotope({
    itemSelector: ".event-item",
  });

  var filters = {
    event: "*",
    type: "",
  };

  $("#event-flters").on("click", "li", function () {
    var $this = $(this);
    var filterValue = $this.attr("data-filter");

    filters["event"] = filterValue;

    var combinedFilter = concatValues(filters);
    $grid.isotope({ filter: combinedFilter });

    $this.addClass("filter-active").siblings().removeClass("filter-active");
  });

  $("#type-flters").on("click", "li", function () {
    var $this = $(this);
    var filterValue = $this.attr("data-filter");

    if ($this.hasClass("filter-active")) {
      filters["type"] = "";
      $this.removeClass("filter-active");
    } else {
      filters["type"] = filterValue;
      $this.addClass("filter-active").siblings().removeClass("filter-active");
    }

    var combinedFilter = concatValues(filters);
    $grid.isotope({ filter: combinedFilter });
  });

  function concatValues(obj) {
    var allFilters = [];
    for (var key in obj) {
      if (obj[key] && obj[key] !== "*") {
        allFilters.push(obj[key]);
      }
    }
    return allFilters.length ? allFilters.join("") : "*";
  }
  $(document).ready(function () {
    const $container = $(".event-container");
    if (!$container.length) return;

    let homeAllVehicles = [];

    function renderHomeCards(data) {
      const locEl = document.getElementById("Home-location");
      const selectedLoc = locEl ? locEl.value : "";
      let filtered = data;
      if (selectedLoc) {
        filtered = data.filter(
          (item) =>
            (item.pickup_location || "").toLowerCase() ===
            selectedLoc.toLowerCase(),
        );
      }
      $container.empty();
      if (!Array.isArray(filtered) || filtered.length === 0) {
        $container.append(
          '<div class="col-12"><p style="color:red;font-weight:bold;text-align:center;">No vehicles found matching your search.</p></div>',
        );
        if ($container.data("isotope")) $container.isotope("destroy");
        return;
      }
      filtered.sort((a, b) => {
        const categoryPriority = {
          "Compact SUV": 0,
          Minivan: 1,
          "Passenger Van": 2,
          Pickup: 3,
          Sedan: 4,
          "Sports Car": 5,
          SUV: 6,
        };
        if (a.category !== b.category) {
          return (
            (categoryPriority[a.category] ?? 999) -
            (categoryPriority[b.category] ?? 999)
          );
        }
        return (a.name || "").localeCompare(b.name || "");
      });
      filtered.forEach((item) => {
        const filters = [];
        if (item.quantity_available > 0) filters.push("filter-Available");
        else filters.push("filter-Booked");
        if (item.category === "Compact SUV") filters.push("filter-CompactSUV");
        if (item.category === "Minivan") filters.push("filter-Minivan");
        if (item.category === "Passenger Van")
          filters.push("filter-PassengerVan");
        if (item.category === "Pickup") filters.push("filter-Pickup");
        if (item.category === "Sedan") filters.push("filter-Sedan");
        if (item.category === "Sports Car") filters.push("filter-SportsCar");
        if (item.category === "SUV") filters.push("filter-SUV");
        const imgUrl =
          item.image && item.image.trim() !== ""
            ? item.image
            : item.image_url && item.image_url.trim() !== ""
              ? item.image_url
              : "assets/img/no-image.png";
        $container.append(`
        <div class="col-lg-4 col-md-6 event-item ${filters.join(" ")}">
          <div class="card">
            <img src="${imgUrl}" class="img-fluid" alt="${item.model || item.category || "Vehicle"}" />
            <div class="card-text">
              <h2>${[item.year, item.make, item.model].filter(Boolean).join(" ") || item.category || "Vehicle"}</h2>
              <p class="hosted-by">Hosted By ${item.host_fname || "Unknown"}</p>
              <p class="desc">${item.description || ""}</p>
              ${item.range ? `<p class="range"><b>Range:</b> ${item.range} mi</p>` : ""}
              <p class="rate">Rate: $${item.rental_rate_per_day} / day</p>
            </div>
          </div>
        </div>
      `);
      });
      if ($container.data("isotope")) {
        $container.isotope("reloadItems").isotope();
      } else if (typeof Isotope !== "undefined") {
        $container.isotope({ itemSelector: ".event-item" });
      }
    }

    function fetchHomeVehicles() {
      const startDate = document.getElementById("Home-start-date")?.value || "";
      const endDate = document.getElementById("Home-end-date")?.value || "";
      const msg = document.getElementById("Home-search-msg");
      let url = "/api/vehicles";
      if (startDate && endDate) {
        url = `/api/vehicles/available?start_date=${startDate}&end_date=${endDate}`;
        if (msg) {
          msg.textContent = `Showing vehicles available from ${startDate} to ${endDate}.`;
          msg.style.display = "";
        }
      } else {
        if (msg) msg.style.display = "none";
      }
      fetch(url, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401) throw new Error("NOT_LOGGED_IN");
            return res.text().then((text) => {
              throw new Error("HTTP " + res.status + " – " + text);
            });
          }
          return res.json();
        })
        .then((data) => {
          homeAllVehicles = data;
          renderHomeCards(data);
        })
        .catch((err) => {
          $container.empty();
          if (err.message === "NOT_LOGGED_IN") {
            $container.append(
              '<div class="col-12"><p style="color:red;font-weight:bold;text-align:center;">Access to the inventory is available to signed-in users only. Please sign in to continue.</p></div>',
            );
          } else {
            $container.append(
              '<div class="col-12"><p style="color:red;font-weight:bold;text-align:center;">Failed to load vehicles. Please try again later.</p></div>',
            );
          }
        });
    }

    fetchHomeVehicles();

    document
      .getElementById("Home-search-btn")
      ?.addEventListener("click", fetchHomeVehicles);

    document
      .getElementById("Home-clear-btn")
      ?.addEventListener("click", function () {
        const startEl = document.getElementById("Home-start-date");
        const endEl = document.getElementById("Home-end-date");
        const locEl = document.getElementById("Home-location");
        const msg = document.getElementById("Home-search-msg");
        if (startEl) startEl.value = "";
        if (endEl) endEl.value = "";
        if (locEl) locEl.value = "";
        if (msg) msg.style.display = "none";
        fetchHomeVehicles();
      });

    document
      .getElementById("Home-location")
      ?.addEventListener("change", function () {
        renderHomeCards(homeAllVehicles);
      });
  });

  document.addEventListener("DOMContentLoaded", function () {
    fetch("/userdetail")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.name) {
          document.getElementById("user-welcome-name").textContent = data.name;
        }
      })
      .catch(() => {});
  });

  document.addEventListener("DOMContentLoaded", function () {
    fetch("/userdetail", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const userType = data?.user_type;
        const loginLink = document.getElementById("login-link");
        const loginLink2 = document.getElementById("login-link-2");

        if (loginLink) {
          loginLink.innerHTML = '<i class="icofont-logout"></i> | Logout';
          loginLink.href = "/logout";
        }
        if (loginLink2) {
          loginLink2.innerHTML = '<i class="icofont-logout"></i> | Logout';
          loginLink2.href = "/logout";
        }

        const navTargets = [
          document.getElementById("main-navbar-list"),
          document.querySelector(".mobile-nav ul"),
        ];

        navTargets.forEach((nav) => {
          if (!nav) return;

          [
            "customer-page-link",
            "return-page-link",
            "account-dropdown",
            "admin-page",
            "owner-page",
          ].forEach((id) => {
            const old = nav.querySelector(`#${id}`);
            if (old) old.remove();
          });
          if (userType === "customer") {
            const dropdownLi = document.createElement("li");
            dropdownLi.classList.add("drop-down");
            dropdownLi.id = "account-dropdown";
            dropdownLi.innerHTML = `
            <a href="#" class="account-toggle">My Account<i class="icofont-simple-down dropdown-arrow"></i></a>
            <ul>
              <li id="dashboard-page-link">
                <a href="account.html" id="dashboard-page-link-anchor">Dashboard</a>
              </li>
              <li id="customer-page-link">
                <a href="vehicle-reservation.html" id="customer-page-link-anchor">Rent Vehicles</a>
              </li>
              <li id="return-page-link">
                <a href="account.html#return" id="return-page-link-anchor">Return Vehicles</a>
              </li>
            </ul>
          `;

            const logoutLi = nav.querySelector("#login-link-li");
            if (logoutLi) {
              nav.insertBefore(dropdownLi, logoutLi);
            } else {
              nav.appendChild(dropdownLi);
            }
          } else if (userType === "admin") {
            const dropdownLi = document.createElement("li");
            dropdownLi.id = "admin-page";
            dropdownLi.innerHTML = `
            <a href="adminPage.html">Admin Portal</a>
          `;

            const logoutLi = nav.querySelector("#login-link-li");
            if (logoutLi) {
              nav.insertBefore(dropdownLi, logoutLi);
            } else {
              nav.appendChild(dropdownLi);
            }
          } else if (userType === "host") {
            const dropdownLi = document.createElement("li");
            dropdownLi.id = "owner-page";
            dropdownLi.innerHTML = `
            <a href="ownerPage.html">Host Portal</a>
          `;

            const logoutLi = nav.querySelector("#login-link-li");
            if (logoutLi) {
              nav.insertBefore(dropdownLi, logoutLi);
            } else {
              nav.appendChild(dropdownLi);
            }
          }
        });
        const current = window.location.pathname + window.location.hash;
        if (current.endsWith("account.html")) {
          document
            .querySelectorAll("#dashboard-page-link-anchor")
            .forEach((a) => a.parentElement.classList.add("active"));
        }
        if (current.endsWith("vehicle-reservation.html")) {
          document
            .querySelectorAll("#customer-page-link-anchor")
            .forEach((a) => a.parentElement.classList.add("active"));
        }
        if (current.endsWith("account.html#return")) {
          document
            .querySelectorAll("#return-page-link-anchor")
            .forEach((a) => a.parentElement.classList.add("active"));
        }
        if (current.endsWith("adminPage.html")) {
          document
            .querySelectorAll('a[href$="adminPage.html"]')
            .forEach((a) => a.parentElement.classList.add("active"));
        }
        if (current.endsWith("maintainancePage.html")) {
          document
            .querySelectorAll('a[href$="maintainancePage.html"]')
            .forEach((a) => a.parentElement.classList.add("active"));
        }
      });
  });
  fetch("/userdetail", { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error("Not Logged in");
      return res.json();
    })
    .then((data) => {
      if (data?.name) {
        const heroLoginBtn = document.getElementById("login-link-3");
        if (heroLoginBtn) heroLoginBtn.style.display = "none";
      }
    })
    .catch(() => {
      /* not logged in, do nothing */
    });
  let allVehicle = [];
  let selectedVehicleSet = new Set();
  let selectedLocation = "";

  function renderVehicle(category) {
    const list = document.getElementById("vehicle-list");
    let filtered = allVehicle.filter((eq) => (eq.quantity_available || 0) > 0);
    if (category) {
      filtered = filtered.filter(
        (eq) =>
          (eq.category || eq.type || "").toLowerCase() ===
          category.toLowerCase(),
      );
    }
    if (selectedLocation) {
      filtered = filtered.filter(
        (eq) =>
          (eq.pickup_location || "").toLowerCase() ===
          selectedLocation.toLowerCase(),
      );
    }

    filtered.sort((a, b) => {
      const categoryPriority = {
        "Compact SUV": 0,
        Minivan: 1,
        "Passenger Van": 2,
        Pickup: 3,
        Sedan: 4,
        "Sports Car": 5,
        SUV: 6,
      };

      if (a.category !== b.category) {
        const priorityA =
          categoryPriority[a.category] !== undefined
            ? categoryPriority[a.category]
            : 999;
        const priorityB =
          categoryPriority[b.category] !== undefined
            ? categoryPriority[b.category]
            : 999;
        return priorityA - priorityB;
      }
      const nameA =
        [a.year, a.make, a.model].filter(Boolean).join(" ") || a.category || "";
      const nameB =
        [b.year, b.make, b.model].filter(Boolean).join(" ") || b.category || "";
      return nameA.localeCompare(nameB);
    });

    if (!filtered.length) {
      list.innerHTML =
        '<div class="col-12"><p>No vehicles available for this category.</p></div>';
      return;
    }
    list.innerHTML = filtered
      .map((eq) => {
        const imgUrl =
          eq.image && eq.image.trim() !== ""
            ? eq.image
            : eq.image_url && eq.image_url.trim() !== ""
              ? eq.image_url
              : "assets/img/no-image.png";
        return `
      <div class="col-md-4 mb-4">
        <div class="card h-100 shadow-sm">
          <img src="${imgUrl}" class="card-img-top" alt="${[eq.year, eq.make, eq.model].filter(Boolean).join(" ") || eq.category || "Vehicle"}" style="height:200px; object-fit:cover; width:100%;">
          <div class="card-body">
            <h5 class="card-title" style="font-variant-numeric: lining-nums; font-feature-settings: 'lnum' 1;">${[eq.year, eq.make, eq.model].filter(Boolean).join(" ") || eq.category || "Vehicle"}</h5>
            <p class="card-text">${eq.description || ""}</p>
            <div style="font-weight:bold;margin-bottom:5px;">
              Price: $${eq.rental_rate_per_day ? Number(eq.rental_rate_per_day).toFixed(2) : "N/A"} per day
            </div>
            ${eq.range ? `<div style="font-size:0.98em;margin-bottom:3px;"><b>Range:</b> ${eq.range} mi</div>` : ""}
            ${eq.pickup_location ? `<div style="font-size:0.98em;margin-bottom:5px;"><b>Pick-Up:</b> ${eq.pickup_location}</div>` : ""}
            <div>
              <input type="checkbox" class="vehicle-checkbox" value="${eq._id}" id="equip_${eq._id}" ${selectedVehicleSet.has(eq._id) ? "checked" : ""}>
              <label for="equip_${eq._id}">Select this Vehicle</label>
            </div>
          </div>
        </div>
      </div>
      `;
      })
      .join("");

    document.querySelectorAll(".vehicle-checkbox").forEach((cb) => {
      cb.addEventListener("change", function () {
        if (this.checked) {
          selectedVehicleSet.clear();
          selectedVehicleSet.add(this.value);
          // Set pickup location from selected vehicle
          const vehicle = allVehicle.find((v) => v._id == this.value);
          const locationInput = document.getElementById("location");
          const locationDisplay = document.getElementById(
            "pickup-location-display",
          );
          if (vehicle && vehicle.pickup_location) {
            if (locationInput) {
              locationInput.value = vehicle.pickup_location;
              locationInput.disabled = true;
            }
            if (locationDisplay)
              locationDisplay.value = vehicle.pickup_location;
          } else {
            if (locationInput) {
              locationInput.value = "";
              locationInput.disabled = true;
            }
            if (locationDisplay) locationDisplay.value = "No location set";
          }
          // Gray out all other vehicle cards
          document.querySelectorAll(".vehicle-checkbox").forEach((other) => {
            if (other !== this) {
              other.checked = false;
              other.disabled = true;
              other.closest(".col-md-4").style.opacity = "0.4";
              other.closest(".col-md-4").style.pointerEvents = "none";
            }
          });
        } else {
          selectedVehicleSet.delete(this.value);
          // Clear pickup location
          const locationInput = document.getElementById("location");
          const locationDisplay = document.getElementById(
            "pickup-location-display",
          );
          if (locationInput) {
            locationInput.value = "";
            locationInput.disabled = false;
          }
          selectedLocation = "";
          if (locationDisplay) locationDisplay.value = "Select a vehicle below";
          // Restore all other vehicle cards
          document.querySelectorAll(".vehicle-checkbox").forEach((other) => {
            other.disabled = false;
            other.closest(".col-md-4").style.opacity = "";
            other.closest(".col-md-4").style.pointerEvents = "";
          });
        }
      });
    });
  }

  function fetchAndRenderVehicles() {
    const startDate = document.getElementById("filter-start-date")?.value || "";
    const endDate = document.getElementById("filter-end-date")?.value || "";
    const dateMsg = document.getElementById("date-filter-msg");

    let url = "/api/vehicles/available";
    if (startDate && endDate) {
      url += `?start_date=${startDate}&end_date=${endDate}`;
      if (dateMsg) {
        dateMsg.textContent = `Showing vehicles available from ${startDate} to ${endDate}.`;
        dateMsg.style.display = "";
      }
    } else {
      if (dateMsg) dateMsg.style.display = "none";
    }

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        allVehicle = data;
        renderVehicle(document.getElementById("vehicle-category").value);
      })
      .catch(() => {
        document.getElementById("vehicle-list").innerHTML =
          '<div class="col-12"><p style="color:red;">Failed to load vehicles. Please try again.</p></div>';
      });
  }

  fetchAndRenderVehicles();

  document
    .getElementById("vehicle-category")
    .addEventListener("change", function () {
      renderVehicle(this.value);
    });

  const formLocation = document.getElementById("location");
  if (formLocation) {
    formLocation.addEventListener("change", function () {
      selectedLocation = this.value;
      renderVehicle(document.getElementById("vehicle-category").value);
    });
  }

  // Date filter inputs — re-fetch vehicles and sync with reservation form
  const filterStartDate = document.getElementById("filter-start-date");
  const filterEndDate = document.getElementById("filter-end-date");
  if (filterStartDate) {
    filterStartDate.addEventListener("change", function () {
      const formStart = document.getElementById("start_date");
      if (formStart) formStart.value = this.value;
      fetchAndRenderVehicles();
    });
  }
  if (filterEndDate) {
    filterEndDate.addEventListener("change", function () {
      const formEnd = document.getElementById("end_date");
      if (formEnd) formEnd.value = this.value;
      fetchAndRenderVehicles();
    });
  }

  // Sync reservation form dates back to filter inputs
  const formStartDate = document.getElementById("start_date");
  const formEndDate = document.getElementById("end_date");
  if (formStartDate) {
    formStartDate.addEventListener("change", function () {
      const f = document.getElementById("filter-start-date");
      if (f) f.value = this.value;
      fetchAndRenderVehicles();
    });
  }
  if (formEndDate) {
    formEndDate.addEventListener("change", function () {
      const f = document.getElementById("filter-end-date");
      if (f) f.value = this.value;
      fetchAndRenderVehicles();
    });
  }

  function calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }

  function showPaymentModal(totalPrice, onConfirm) {
    const taxRate = 0.06;
    const taxAmount = totalPrice * taxRate;
    const totalWithTax = totalPrice + taxAmount;
    document.getElementById("reservation-modal-title").textContent =
      "Reservation Summary";
    document.getElementById("reservation-modal-body").innerHTML = `
    <p style="font-size:1.2em;">Subtotal: <b>$${totalPrice.toFixed(2)}</b></p>
    <p style="font-size:1.1em;">Tax (6%): <b>$${taxAmount.toFixed(2)}</b></p>
    <p style="font-size:1.2em;">Total Price: <b>$${totalWithTax.toFixed(2)}</b></p>
    <p style="margin-top:10px;">Please proceed to payment to complete your reservation.</p>
    <button id="pay-now-btn" style="padding:8px 24px; font-size:1.1em; border:none; background:#28a745; color:#fff; border-radius:5px; cursor:pointer; margin-top:10px;">Pay Now</button>
  `;
    document.getElementById("reservation-modal").style.display = "flex";
    document.getElementById("pay-now-btn").onclick = function () {
      document.getElementById("reservation-modal").style.display = "none";
      onConfirm();
    };
  }

  document
    .getElementById("reservation-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      document.getElementById("reservation-error").textContent = "";
      document.getElementById("reservation-success").textContent = "";
      document.getElementById("selected-vehicle").value = JSON.stringify(
        Array.from(selectedVehicleSet),
      );
      if (selectedVehicleSet.size === 0) {
        document.getElementById("reservation-error").textContent =
          "Please select at least one vehicle to reserve.";
        return;
      }
      const selectedIds = Array.from(selectedVehicleSet);
      const startDate = document.getElementById("start_date").value;
      const endDate = document.getElementById("end_date").value;
      if (!startDate) {
        document.getElementById("reservation-error").textContent =
          "Please select a start date.";
        return;
      }
      if (!endDate) {
        document.getElementById("reservation-error").textContent =
          "Please select a return date.";
        return;
      }
      if (endDate <= startDate) {
        document.getElementById("reservation-error").textContent =
          "Return date must be after start date.";
        return;
      }
      const days = calculateDays(startDate, endDate);
      let totalPrice = 0;
      selectedIds.forEach((id) => {
        const eq = allVehicle.find((eq) => eq._id == id);
        if (eq && eq.rental_rate_per_day) {
          totalPrice += Number(eq.rental_rate_per_day) * days;
        }
      });
      const taxRate = 0.06;
      const taxAmount = totalPrice * taxRate;
      const totalWithTax = totalPrice + taxAmount;
      document.getElementById("total-cost").value = totalWithTax.toFixed(2);
      showPaymentModal(totalPrice, () => {
        const form = document.getElementById("reservation-form");
        const formData = new FormData(form);
        // Disabled fields aren't included in FormData — manually add location
        const locationEl = document.getElementById("location");
        if (locationEl && locationEl.disabled && locationEl.value) {
          formData.set("location", locationEl.value);
        }
        fetch(form.action, {
          method: "POST",
          body: new URLSearchParams([...formData]),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.error) {
              document.getElementById("reservation-error").textContent =
                data.error;
              document.getElementById("reservation-success").textContent = "";
            } else {
              let msg = "";
              if (
                data.unavailable_vehicle_ids &&
                data.unavailable_vehicle_ids.length > 0
              ) {
                msg = `<div style="color:green;font-weight:bold;">Reservation successful for available vehicles only.</div>
                    <div style="color:red;font-weight:bold;">Some vehicles was already booked and not reserved.</div>`;
              } else {
                msg = `<div style="color:green;font-weight:bold;">Reservation successful!</div>`;
              }
              document.getElementById("reservation-modal-title").textContent =
                "Reservation successful!";
              document.getElementById("reservation-modal-body").innerHTML = `
            ${msg}
            <button id="close-modal-btn" style="padding:8px 24px; font-size:1.1em; border:none; background:#007bff; color:#fff; border-radius:5px; cursor:pointer; margin-top:10px;">Okay</button>
          `;
              document.getElementById("reservation-modal").style.display =
                "flex";
              document.getElementById("close-modal-btn").onclick = function () {
                document.getElementById("reservation-modal").style.display =
                  "none";
                window.location.reload();
              };
              document.getElementById("reservation-success").textContent = "";
              document.getElementById("reservation-error").textContent = "";
              selectedVehicleSet.clear();
              renderVehicle(document.getElementById("vehicle-category").value);
            }
          })
          .catch(() => {
            document.getElementById("reservation-error").textContent =
              "Reservation failed. Please try again.";
            document.getElementById("reservation-success").textContent = "";
          });
      });
    });

  function populatePaymentDropdown() {
    fetch("/api/mypayments")
      .then((res) => res.json())
      .then((payments) => {
        const paymentSelect = document.getElementById("payment");
        if (paymentSelect && payments && payments.length > 0) {
          paymentSelect.innerHTML =
            '<option value="" disabled selected>-- Choose Payment --</option>';

          payments.forEach((payment, index) => {
            const option = document.createElement("option");
            option.value = payment.payment_nickname || `payment_${index}`;
            option.textContent = `${payment.card_type} ending in ${payment.last4} (${payment.payment_nickname || "Card " + (index + 1)})`;
            paymentSelect.appendChild(option);
          });
        }
      })
      .catch((err) => {
        console.log("Could not load payment methods:", err);
      });
  }

  function populateAddressDropdown() {
    fetch("/api/myaddress")
      .then((res) => res.json())
      .then((addresses) => {
        const addressSelect = document.getElementById("address");
        if (addressSelect && addresses && addresses.length > 0) {
          addressSelect.innerHTML =
            '<option value="" disabled selected>-- Choose Billing address--</option>';

          addresses.forEach((address, index) => {
            const option = document.createElement("option");
            option.value = address.address_nickname || `address_${index}`;
            option.textContent = `${address.address_line1}, ${address.city}, ${address.state} ${address.zip_code} (${address.address_nickname || "Address " + (index + 1)})`;
            addressSelect.appendChild(option);
          });
        }
      })
      .catch((err) => {
        console.log("Could not load addresses:", err);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetch("/api/userinfo")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.name) {
          const customerNameField = document.getElementById("customer_name");
          const welcomeNameField = document.getElementById("user-welcome-name");
          if (customerNameField) customerNameField.value = data.name;
          if (welcomeNameField) welcomeNameField.textContent = data.name;
        }
      })
      .catch(() => {});

    if (window.location.pathname.endsWith("vehicle-reservation.html")) {
      populatePaymentDropdown();
      populateAddressDropdown();

      const addPaymentBtn = document.getElementById("add-payment-btn");
      const addAddressBtn = document.getElementById("add-address-btn");
      const paymentForm = document.getElementById("Payment-form");
      const addressForm = document.getElementById("Address-form");

      if (addPaymentBtn && paymentForm) {
        addPaymentBtn.addEventListener("click", function () {
          paymentForm.classList.toggle("hidden-form");
          addPaymentBtn.textContent = paymentForm.classList.contains(
            "hidden-form",
          )
            ? "+ Add New Payment Method"
            : "- Hide Payment Form";
        });
      }

      if (addAddressBtn && addressForm) {
        addAddressBtn.addEventListener("click", function () {
          addressForm.classList.toggle("hidden-form");
          addAddressBtn.textContent = addressForm.classList.contains(
            "hidden-form",
          )
            ? "+ Add New Address"
            : "- Hide Address Form";
        });
      }
      const cardField = document.getElementById("card_number");
      if (cardField) {
        cardField.addEventListener("input", function () {
          let digits = this.value.replace(/\D/g, "").substring(0, 16);
          let formatted = digits.match(/.{1,4}/g)?.join("-") || "";
          this.value = formatted;
        });
      }
      ["payment_zip_code", "cvv"].forEach(function (fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
          field.addEventListener("input", function () {
            this.value = this.value.replace(/[^\d]/g, "");
          });
        }
      });

      if (paymentForm) {
        paymentForm.addEventListener("submit", function (e) {
          e.preventDefault();

          const cardNumberFormatted = paymentForm.card_number.value.trim();
          const rawCardNumber = cardNumberFormatted.replace(/\D/g, "");
          const zipCode = paymentForm.payment_zip_code.value.trim();
          const cvv = paymentForm.cvv.value.trim();

          let errorMsg = "";
          if (!/^\d{16}$/.test(rawCardNumber)) {
            errorMsg = "Card number must be exactly 16 digits.";
          } else if (!/^\d{5}$/.test(zipCode)) {
            errorMsg = "Zip code must be exactly 5 digits.";
          } else if (!/^\d{3,4}$/.test(cvv)) {
            errorMsg = "CVV must be 3 or 4 digits.";
          }

          if (errorMsg) {
            document.getElementById("payments-error").textContent = errorMsg;
            document.getElementById("payments-success").textContent = "";
            return;
          }

          const formData = new FormData(paymentForm);
          formData.set("card_number", rawCardNumber);

          fetch("/payments", {
            method: "POST",
            body: new URLSearchParams([...formData]),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.message || data.success || !data.error) {
                document.getElementById("payments-success").textContent =
                  "Payment method added successfully!";
                document.getElementById("payments-error").textContent = "";
                paymentForm.reset();

                setTimeout(() => {
                  populatePaymentDropdown();
                  paymentForm.classList.add("hidden-form");
                  if (addPaymentBtn) {
                    addPaymentBtn.textContent = "+ Add New Payment Method";
                  }
                }, 1000);
              } else {
                document.getElementById("payments-error").textContent =
                  data.error || "Failed to add payment method";
                document.getElementById("payments-success").textContent = "";
              }
            })
            .catch((err) => {
              console.error("Payment submit error:", err);
              document.getElementById("payments-error").textContent =
                "Failed to add payment method";
              document.getElementById("payments-success").textContent = "";
            });
        });
      }

      if (addressForm) {
        addressForm.addEventListener("submit", function (e) {
          e.preventDefault();
          const formData = new FormData(addressForm);

          fetch("/addresses", {
            method: "POST",
            body: new URLSearchParams([...formData]),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.message || data.success || !data.error) {
                document.getElementById("address-success").textContent =
                  "Address added successfully!";
                document.getElementById("address-error").textContent = "";
                addressForm.reset();
                setTimeout(() => {
                  populateAddressDropdown();
                  addressForm.classList.add("hidden-form");
                  addAddressBtn.textContent = "+ Add New Address";
                }, 1000);
              } else {
                document.getElementById("address-error").textContent =
                  data.error || "Failed to add address";
                document.getElementById("address-success").textContent = "";
              }
            })
            .catch(() => {
              document.getElementById("address-error").textContent =
                "Failed to add address";
              document.getElementById("address-success").textContent = "";
            });
        });
      }
    }

    if (localStorage.getItem("showReservationModal") === "1") {
      document.getElementById("reservation-modal-title").textContent =
        "Reservation successful!";
      document.getElementById("reservation-modal-body").innerHTML = `
        <div style="color:green;font-weight:bold;">Reservation successful!</div>
        <button id="close-modal-btn" style="padding:8px 24px; font-size:1.1em; border:none; background:#007bff; color:#fff; border-radius:5px; cursor:pointer; margin-top:10px;">Okay</button>
      `;
      document.getElementById("reservation-modal").style.display = "flex";
      document.getElementById("close-modal-btn").onclick = function () {
        document.getElementById("reservation-modal").style.display = "none";
        window.location.reload();
      };
      localStorage.removeItem("showReservationModal");
    }
  });

/* ==========================================================
   Login Form
   ========================================================== */
(function () {
  if (!document.getElementById("login-error-modal")) return;

  var params = new URLSearchParams(window.location.search);
  var serverError = params.get("error");
  if (serverError) {
    document.getElementById("login-error-modal-message").textContent = decodeURIComponent(serverError);
    document.getElementById("login-error-modal").style.display = "flex";
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
  }
}());

/* ==========================================================
   Registration Form
   ========================================================== */
(function () {
  if (!document.getElementById("register-form")) return;

  /* Server-side error modal */
  var params = new URLSearchParams(window.location.search);
  var serverError = params.get("error");
  if (serverError) {
    document.getElementById("error-modal-message").textContent = decodeURIComponent(serverError);
    document.getElementById("error-modal").style.display = "flex";
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
  }

  /* Account type selection */
  var selectedAccountType = "";

  window.selectType = function (type) {
    selectedAccountType = type;
    document.getElementById("user_type").value = type;
    var rBtn = document.getElementById("btn-renter");
    var hBtn = document.getElementById("btn-host");
    rBtn.classList.remove("selected-renter", "selected-host");
    hBtn.classList.remove("selected-renter", "selected-host");
    if (type === "customer") rBtn.classList.add("selected-renter");
    if (type === "host")     hBtn.classList.add("selected-host");
  };

  /* Password strength */
  document.getElementById("password").addEventListener("input", function () {
    var val   = this.value;
    var score = 0;
    if (val.length >= 8)                        score++;
    if (/[A-Z]/.test(val))                      score++;
    if (/[a-z]/.test(val))                      score++;
    if (/[0-9]/.test(val))                      score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(val))    score++;

    var levels = [
      { pct: "0%",   color: "#e0e8f5", label: "" },
      { pct: "25%",  color: "#e74c3c", label: "Weak" },
      { pct: "50%",  color: "#e67e22", label: "Fair" },
      { pct: "75%",  color: "#f1c40f", label: "Good" },
      { pct: "100%", color: "#27ae60", label: "Strong" },
    ];
    var lvl  = levels[Math.min(score, 4)];
    var fill = document.getElementById("pw-fill");
    var text = document.getElementById("pw-text");
    fill.style.width      = lvl.pct;
    fill.style.background = lvl.color;
    text.textContent      = lvl.label;
    text.style.color      = lvl.color;
  });

  /* Error helpers */
  function showError(msg) {
    var el = document.getElementById("inline-error");
    el.textContent = msg;
    el.classList.add("visible");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function clearError() {
    var el = document.getElementById("inline-error");
    el.textContent = "";
    el.classList.remove("visible");
  }

  /* Step switcher */
  function goToStep(n) {
    document.querySelectorAll(".step-panel").forEach(function (p) { p.classList.remove("active"); });
    document.getElementById("step-" + n).classList.add("active");

    var b1 = document.getElementById("bubble-1");
    var b2 = document.getElementById("bubble-2");
    var l1 = document.getElementById("label-1");
    var l2 = document.getElementById("label-2");
    var ln = document.getElementById("connector-line");

    if (n === 1) {
      b1.className = "step-bubble active";
      b2.className = "step-bubble";
      l1.className = "step-label active";
      l2.className = "step-label";
      ln.className = "step-line";
    } else {
      b1.className = "step-bubble done";
      b2.className = "step-bubble active";
      l1.className = "step-label done";
      l2.className = "step-label active";
      ln.className = "step-line done";
    }
  }

  /* Next: validate step 1 */
  document.getElementById("next-btn").addEventListener("click", function () {
    clearError();

    var fname     = document.getElementById("fname").value.trim();
    var lname     = document.getElementById("lname").value.trim();
    var email     = document.getElementById("email").value.trim();
    var username  = document.getElementById("username").value.trim();
    var password  = document.getElementById("password").value;
    var cpassword = document.getElementById("cpassword").value;

    if (!selectedAccountType)                                   { showError("Please choose an account type — Renter or Host."); return; }
    if (!fname || !lname)                                       { showError("Please enter your first and last name."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   { showError("Please enter a valid email address."); return; }
    if (!username || username.length < 3)                       { showError("Username must be at least 3 characters."); return; }
    if (password.length < 8)                                    { showError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(password))                                { showError("Password must contain at least one uppercase letter."); return; }
    if (!/[a-z]/.test(password))                                { showError("Password must contain at least one lowercase letter."); return; }
    if (!/[0-9]/.test(password))                                { showError("Password must contain at least one number."); return; }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))              { showError("Password must contain at least one special character (!@#$%^&*…)."); return; }
    if (password !== cpassword)                                  { showError("Passwords do not match."); return; }

    goToStep(2);
  });

  /* Back */
  document.getElementById("back-btn").addEventListener("click", function () {
    clearError();
    goToStep(1);
  });

  /* Submit: validate step 2 */
  document.getElementById("register-form").addEventListener("submit", function (e) {
    clearError();

    var s1 = document.getElementById("security1").value;
    var s2 = document.getElementById("security2").value;
    var s3 = document.getElementById("security3").value;
    var a1 = document.getElementById("answer1").value.trim();
    var a2 = document.getElementById("answer2").value.trim();
    var a3 = document.getElementById("answer3").value.trim();

    if (!s1 || !s2 || !s3) { e.preventDefault(); showError("Please select a question for each security field."); return; }
    if (!a1 || !a2 || !a3) { e.preventDefault(); showError("Please provide an answer for each security question."); return; }
    if (new Set([s1, s2, s3]).size < 3) { e.preventDefault(); showError("Please choose three different security questions."); return; }
  });
}());
})(jQuery);
