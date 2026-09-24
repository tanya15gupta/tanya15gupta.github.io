/**
 * Tanya Gupta - portfolio
 * No dependencies.
 */
(function () {
  "use strict";

  /* ----------------------------------------------------------
   * Where the contact form posts.
   *
   * FormSubmit needs no account, but the FIRST message sent from a new
   * domain triggers a confirmation email to the address below - click the
   * link in it once and every later message is delivered straight away.
   *
   * To use a different service (Formspree, Web3Forms, your own endpoint),
   * just replace this URL. Anything that accepts a JSON POST works.
   * -------------------------------------------------------- */
  var CONTACT_ENDPOINT = "https://formsubmit.co/ajax/tanya1115gupta@gmail.com";
  var CONTACT_FALLBACK = "tanya1115gupta@gmail.com";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ----------------------------------------------------------
   * Reveal on scroll
   * -------------------------------------------------------- */
  var revealables = $$(".reveal");

  if (revealables.length) {
    if ("IntersectionObserver" in window) {
      var reveal = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            var delay = parseInt(el.dataset.delay || "0", 10);
            setTimeout(function () { el.classList.add("is-in"); }, delay);
            obs.unobserve(el);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      revealables.forEach(function (el) { reveal.observe(el); });
    } else {
      revealables.forEach(function (el) { el.classList.add("is-in"); });
    }
  }

  /* ----------------------------------------------------------
   * Hero typewriter
   * -------------------------------------------------------- */
  var typedEl = $(".typed");

  if (typedEl && typedEl.dataset.words) {
    var words = typedEl.dataset.words.split("|");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      typedEl.textContent = words[0];
    } else {
      var w = 0;
      var c = 0;
      var erasing = false;

      var tick = function () {
        var word = words[w];
        typedEl.textContent = word.slice(0, c);

        if (!erasing && c === word.length) {
          erasing = true;
          return setTimeout(tick, 1600);
        }

        if (erasing && c === 0) {
          erasing = false;
          w = (w + 1) % words.length;
          return setTimeout(tick, 320);
        }

        c += erasing ? -1 : 1;
        setTimeout(tick, erasing ? 34 : 78);
      };

      tick();
    }
  }

  /* ----------------------------------------------------------
   * Project filter
   * -------------------------------------------------------- */
  var filterBar = $(".filters");

  if (filterBar) {
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) return;

      var want = btn.dataset.filter;

      $$("button[data-filter]", filterBar).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });

      $$(".project").forEach(function (card) {
        var match = want === "all" || (card.dataset.tags || "").split(" ").indexOf(want) > -1;
        card.classList.toggle("is-hidden", !match);
      });
    });
  }

  /* ----------------------------------------------------------
   * Back to top
   * -------------------------------------------------------- */
  var toTop = $(".to-top");

  if (toTop) {
    var toggleTop = function () {
      toTop.classList.toggle("is-shown", window.scrollY > 500);
    };
    toggleTop();
    window.addEventListener("scroll", toggleTop, { passive: true });
  }

  /* ----------------------------------------------------------
   * Gallery lightbox (project detail pages)
   * -------------------------------------------------------- */
  var gallery = $(".gallery");

  if (gallery) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML =
      '<button class="lightbox-close" type="button" aria-label="Close">&times;</button><img alt="">';
    document.body.appendChild(box);

    var boxImg = $("img", box);

    var close = function () {
      box.classList.remove("is-open");
      boxImg.removeAttribute("src");
      document.body.style.overflow = "";
    };

    gallery.addEventListener("click", function (e) {
      var img = e.target.closest("img");
      if (!img) return;
      boxImg.src = img.src;
      boxImg.alt = img.alt || "";
      box.classList.add("is-open");
      document.body.style.overflow = "hidden";
    });

    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".lightbox-close")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("is-open")) close();
    });
  }

  /* ----------------------------------------------------------
   * Hero video clip (optional)
   *
   * Only reveal the <video> once it has real frames. If the file is
   * missing, blocked, or the browser refuses to autoplay, the animated
   * scene underneath stays on screen instead of a black rectangle.
   * -------------------------------------------------------- */
  var clip = $(".hero-clip");
  var heroEl = $(".hero");

  if (clip && heroEl) {
    var showClip = function () {
      if (clip.videoWidth > 0) heroEl.classList.add("has-clip");
    };

    clip.addEventListener("loadeddata", showClip);
    clip.addEventListener("error", function () {
      heroEl.classList.remove("has-clip");
    });

    // Autoplay can be refused silently; the catch keeps the scene showing.
    var attempt = clip.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () {
        heroEl.classList.remove("has-clip");
      });
    }

    if (clip.readyState >= 2) showClip();
  }

  /* ----------------------------------------------------------
   * Contact form
   * -------------------------------------------------------- */
  var form = $("#contact-form");

  if (form) {
    var statusEl = $("#form-status");
    var submitBtn = $("button[type=submit]", form);
    var btnLabel = $(".btn-label", submitBtn);
    var idleLabel = btnLabel.textContent;

    var setStatus = function (kind, html) {
      statusEl.className = "form-status is-shown " + (kind === "ok" ? "is-ok" : "is-err");
      statusEl.innerHTML =
        '<svg class="icon"><use href="#i-' + (kind === "ok" ? "check" : "alert") + '"></use></svg><span>' +
        html + "</span>";
    };

    var clearStatus = function () {
      statusEl.className = "form-status";
      statusEl.textContent = "";
    };

    var mailtoLink = function (data) {
      return (
        "mailto:" + CONTACT_FALLBACK +
        "?subject=" + encodeURIComponent(data.subject || "Message from your portfolio") +
        "&body=" + encodeURIComponent(data.message + "\n\n— " + data.name + " (" + data.email + ")")
      );
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearStatus();

      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        subject: form.subject.value.trim(),
        message: form.message.value.trim()
      };

      // Bot filled the honeypot - pretend all is well and drop it.
      if (form._honey.value) {
        setStatus("ok", "Thanks! Your message has been sent.");
        form.reset();
        return;
      }

      if (!data.name || !data.email || !data.subject || !data.message) {
        setStatus("err", "Please fill in every field before sending.");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        setStatus("err", "That email address does not look right.");
        return;
      }

      submitBtn.disabled = true;
      btnLabel.textContent = "Sending…";

      fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
          _subject: "Portfolio: " + data.subject,
          _template: "table"
        })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function () {
          setStatus("ok", "Thanks! Your message has been sent — I'll get back to you soon.");
          form.reset();
        })
        .catch(function () {
          setStatus(
            "err",
            'Could not send that automatically. <a href="' + mailtoLink(data) +
              '">Open it in your email app instead</a>.'
          );
        })
        .then(function () {
          submitBtn.disabled = false;
          btnLabel.textContent = idleLabel;
        });
    });
  }

  /* ----------------------------------------------------------
   * Footer year
   * -------------------------------------------------------- */
  var year = $("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
