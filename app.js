/**
 * app.js｜恆春民宿前台資料與互動
 *
 * 功能索引：
 * 01. Supabase 初始化與 DOM 快取
 * 02. 網站文字、訂房須知與聯絡方式
 * 03. 相簿分類與排序
 * 04. 民宿卡片與價格比較表
 * 05. 民宿詳情 Modal 與 Lightbox
 * 06. 從 Supabase 載入前台資料
 * 07. 點擊、鍵盤與導覽互動
 *
 * 備註：
 * - 保留原有資料查詢、顯示內容與互動邏輯。
 * - 僅整理縮排、換行與註解。
 */

(() => {
  const cfg = window.APP_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes("PASTE_") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
  const esc = (s = "") =>
    String(s).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  const nl = (s) => esc(s).replace(/\n/g, "<br>");
  const loading = document.querySelector("#loadingState");
  const grid = document.querySelector("#stayGrid");
  const compare = document.querySelector("#compareBody");
  const modal = document.querySelector("#stayModal");
  const modalContent = document.querySelector("#modalContent");
  const lightbox = document.querySelector("#lightbox");
  const lightboxImage = document.querySelector("#lightboxImage");
  const lightboxCaption = document.querySelector("#lightboxCaption");
  const contactLinksContainer = document.getElementById("contactLinks");
  let activeImages = [],
    activeImageIndex = 0,
    stays = [];

  if (!configured) {
    loading.innerHTML =
      '<div class="error-banner"><strong>尚未連接資料庫。</strong><br>請依照 README 的步驟設定 Supabase，並修改 config.js。</div>';
    return;
  }

  const db = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // ============================================================
  // 2. 網站文字、訂房須知與聯絡方式
  // ============================================================
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "";
  }
  function renderSettings(settings) {
    const s = Object.fromEntries(settings.map((x) => [x.key, x.value]));
    setText("introTitle", s.intro_title);
    setText("introP1", s.intro_p1);
    setText("introP2", s.intro_p2);
    setText("priceNote1", s.price_note_1);
    setText("priceNote2", s.price_note_2);
    setText("contactTitle", s.contact_title);
    setText("contactText", s.contact_text);
    const hero = document.getElementById("heroImage");
    if (s.hero_image_url) hero.src = s.hero_image_url;
    const contactLinksContainer = document.getElementById("contactLinks");
    const notices = [1, 2, 3, 4, 5, 6]
      .map((i) => ({
        title: s[`notice_${i}_title`] || "",
        body: s[`notice_${i}_body`] || "",
      }))
      .filter((x) => x.title || x.body);
    document.getElementById("noticeGrid").innerHTML = notices
      .map(
        (n, i) => `
      <article class="notice-card"><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(n.title)}</h3><p>${nl(n.body)}</p></article>
    `,
      )
      .join("");
  }
  function getContactHref(item) {
    const value = String(item.value || "").trim();

    switch (item.type) {
      case "phone":
        return `tel:${value.replace(/[^\d+]/g, "")}`;

      case "email":
        return `mailto:${value}`;

      default:
        return value || "#";
    }
  }

  function renderContactLinks(contactLinks) {
    if (!contactLinksContainer) {
      return;
    }

    contactLinksContainer.innerHTML = (contactLinks || [])
      .map((item, index) => {
        const href = getContactHref(item);

        const buttonClass = index === 0 ? "primary-button" : "secondary-button";

        const external = item.type !== "phone" && item.type !== "email";

        return `
        <a
          class="${buttonClass}"
          href="${esc(href)}"
          ${external ? 'target="_blank" rel="noopener"' : ""}
        >
          ${esc(item.title)}
        </a>
      `;
      })
      .join("");
  }
  // ============================================================
  // 3. 相簿分類與排序
  // ============================================================
  function photoGroups(images = []) {
    const sortImages = (list) =>
      [...list].sort((a, b) => {
        const orderDiff =
          (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);

        if (orderDiff !== 0) {
          return orderDiff;
        }

        return String(a.id).localeCompare(String(b.id));
      });

    return {
      day: sortImages(images.filter((image) => image.category === "day")),
      night: sortImages(images.filter((image) => image.category === "night")),
      rooms: sortImages(images.filter((image) => image.category === "room")),
    };
  }
  const formatPrice = (value, slug = "") => {
    const safe = esc(value || "");
    return slug === "lijing" ? safe : safe.replaceAll("、", "\n");
  };
  // ============================================================
  // 4. 民宿卡片與價格比較表
  // ============================================================
  function renderStays() {
    loading.style.display = "none";
    if (!stays.length) {
      grid.innerHTML = '<div class="empty-state">目前沒有上架中的民宿。</div>';
      compare.innerHTML = "";
      return;
    }
    grid.innerHTML = stays
      .map((s, i) => {
        const total = 1 + (s.stay_images?.length || 0);
        return `
          <article
            class="stay-card"
            data-index="${i}"
            tabindex="0"
            role="button"
            aria-label="查看 ${esc(s.name)} 完整介紹"
          >
            <div class="stay-visual">
              <img
                src="${esc(s.cover_image_url)}"
                alt="${esc(s.name)}封面照片"
                loading="lazy"
              >

              <span class="stay-no">
                ${esc(s.no_label)}
              </span>

              <span class="photo-count">
                ${total} 張照片
              </span>
            </div>

            <div class="stay-content">
              <h3>${esc(s.name)}</h3>

              <p class="stay-type">
                ${esc(s.label)}
              </p>

              <div class="stay-facts">
                <div class="fact">
                  <small>包棟人數</small>
                  <strong>${esc(s.capacity)}</strong>
                </div>

                <div class="fact">
                  <small>入住時間</small>
                  <strong>
                    ${esc(
                      String(s.checkin || "")
                        .split(/\r?\n/)[0]
                        .split("※")[0]
                        .split(/[（(]/)[0]
                        .trim()
                    )}
                  </strong>
                </div>

                <div class="fact">
                  <small>退房時間</small>
                  <strong>
                    ${esc(
                      String(s.checkout || "")
                        .split(/\r?\n/)[0]
                        .split("※")[0]
                        .split(/[（(]/)[0]
                        .trim()
                    )}
                  </strong>
                </div>
              </div>

              <p class="stay-room">
                ${esc(s.room_types)}
              </p>

              <button
                class="card-button"
                type="button"
              >
                查看完整介紹與相片
              </button>
            </div>
          </article>
        `;
      })
      .join("");
    compare.innerHTML = stays
      .map(
        (
          s,
        ) => `<tr><td><strong>${esc(s.no_label)}｜${esc(s.name)}</strong><br><small>${esc(s.label)}</small></td>
      <td>${esc(s.capacity)}${s.no_label === "一館" ? " (可單房／包棟)" : ""}</td><td>${esc(s.room_types)}</td>
      <td class="price-block">${formatPrice(s.high_season_price, s.slug)}</td>
      <td class="price-block">${formatPrice(s.low_season_price, s.slug)}</td></tr>`,
      )
      .join("");
  }
  // ============================================================
  // 5. 民宿詳情 Modal 與 Lightbox
  // ============================================================
  function galleryBlock(title, images, s) {
    if (!images.length) return "";
    return `<section class="gallery-section"><h3>${title}</h3><div class="gallery-grid">${images
      .map(
        (img, i) => `
      <button class="gallery-item" data-gallery-src="${esc(img.image_url)}" data-gallery-caption="${esc(s.name)}｜${title} ${i + 1}">
      <img src="${esc(img.image_url)}" alt="${esc(s.name)}${title}照片 ${i + 1}" loading="lazy"></button>`,
      )
      .join("")}</div></section>`;
  }
  function openModal(s) {
    const g = photoGroups(s.stay_images || []);
    const facilities = (s.stay_facilities || [])
      .map((item) => item.facility_options)
      .filter((item) => item && item.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    const features = facilities
      .map((item) => `<span>${esc(item.name)}</span>`)
      .join("");
    modalContent.innerHTML = `<div class="modal-hero"><img src="${esc(s.cover_image_url)}" alt="${esc(s.name)}封面">
      <div class="modal-hero-copy"><p>${esc(s.no_label)}｜${esc(s.label)}</p><h2>${esc(s.name)}</h2></div></div>
      <div class="modal-prices"><div class="season"><h4>旺季【6~9月】</h4><p>${formatPrice(s.high_season_price, s.slug)}</p></div>
      <div class="season"><h4>淡季【10~5月】</h4><p>${formatPrice(s.low_season_price, s.slug)}</p></div></div>
      <div class="modal-note">${nl(s.note)}</div>
      <div class="modal-grid">
      <div class="detail-box"><h4>房型</h4><p>${nl(s.room_types)}</p></div>
      <div class="detail-box"><h4>加床服務</h4><p>${nl(s.extra_bed)}</p></div>
      <div class="detail-box wide"><h4>地址</h4><p>${nl(s.address)}</p></div>
      <div class="detail-box"><h4>入住時間</h4><p>${nl(s.checkin)}</p></div>
      <div class="detail-box"><h4>退房時間</h4><p>${nl(s.checkout)}</p></div>
      <div class="detail-box wide"><h4>入住押金</h4><p>${nl(s.security_deposit)}</p></div>
      <div class="detail-box wide"><h4>訂房訂金</h4><p>${nl(s.booking_deposit)}</p></div>
      <div class="detail-box wide"><h4>設施</h4><div class="feature-list">${features}</div></div></div>
      ${galleryBlock("公共區域｜白天", g.day, s)}${galleryBlock("公共區域｜夜景", g.night, s)}${galleryBlock("房間照片", g.rooms, s)}`;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    modal.querySelector(".modal-panel").scrollTop = 0;
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
  }
  function openLightbox(src, caption) {
    activeImages = [...modalContent.querySelectorAll("[data-gallery-src]")].map(
      (x) => ({ src: x.dataset.gallerySrc, caption: x.dataset.galleryCaption }),
    );
    activeImageIndex = Math.max(
      0,
      activeImages.findIndex((x) => x.src === src),
    );
    renderLightbox();
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  }
  function renderLightbox() {
    const item = activeImages[activeImageIndex];
    if (!item) return;
    lightboxImage.src = item.src;
    lightboxImage.alt = item.caption;
    lightboxCaption.textContent = `${item.caption}（${activeImageIndex + 1}/${activeImages.length}）`;
  }
  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
  }
  function shiftLightbox(step) {
    activeImageIndex =
      (activeImageIndex + step + activeImages.length) % activeImages.length;
    renderLightbox();
  }

  // ============================================================
  // 6. 從 Supabase 載入前台資料
  // ============================================================
  async function init() {
    const [
      { data: stayData, error: stayErr },
      { data: settingsData, error: settingsErr },
      { data: priceNotes, error: priceNotesErr },
      { data: bookingNotices, error: bookingNoticesErr },
      { data: contactLinks, error: contactLinksErr },
    ] = await Promise.all([
      db
        .from("stays")
        .select(
          `
          *,
          stay_images(*),
          stay_facilities(
            facility_options(
              id,
              name,
              sort_order,
              is_active
            )
          )
        `,
        )
        .eq("is_published", true)
        .order("sort_order"),

      db.from("site_settings").select("key, value"),

      db
        .from("price_notes")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order"),

      db
        .from("booking_notices")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order"),

      db
        .from("contact_links")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order"),
    ]);

    const firstError =
      stayErr ||
      settingsErr ||
      priceNotesErr ||
      bookingNoticesErr ||
      contactLinksErr;

    if (firstError) {
      loading.innerHTML = `
        <div class="error-banner">
          <strong>資料載入失敗</strong><br>
          ${esc(firstError.message)}
        </div>
      `;
      return;
    }

    stays = stayData || [];

    renderSettings(settingsData || []);
    renderStays();
    renderContactLinks(contactLinks || []);

    document.querySelector(".price-notes").innerHTML = (priceNotes || [])
      .map(
        (note) => `
        <p>${nl(note.content)}</p>
      `,
      )
      .join("");

    document.getElementById("noticeGrid").innerHTML = (bookingNotices || [])
      .map(
        (notice, index) => `
        <article class="notice-card">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${esc(notice.title)}</h3>
          <p>${nl(notice.content)}</p>
        </article>
      `,
      )
      .join("");
  }

  // ============================================================
  // 7. 點擊、鍵盤與導覽互動
  // ============================================================
  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-index]");
    if (card) openModal(stays[Number(card.dataset.index)]);
    if (e.target.closest("[data-close-modal]")) closeModal();
    const photo = e.target.closest("[data-gallery-src]");
    if (photo)
      openLightbox(photo.dataset.gallerySrc, photo.dataset.galleryCaption);
    if (e.target.closest("[data-close-lightbox]")) closeLightbox();
    if (e.target.closest("[data-lightbox-prev]")) shiftLightbox(-1);
    if (e.target.closest("[data-lightbox-next]")) shiftLightbox(1);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (lightbox.classList.contains("open")) closeLightbox();
      else closeModal();
    }
    if (lightbox.classList.contains("open") && e.key === "ArrowLeft")
      shiftLightbox(-1);
    if (lightbox.classList.contains("open") && e.key === "ArrowRight")
      shiftLightbox(1);
  });
  const toggle = document.querySelector(".menu-toggle"),
    nav = document.querySelector(".main-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", () => nav.classList.remove("open"));
  document.querySelector("#year").textContent = new Date().getFullYear();
  document
    .querySelector("#backToTop")
    ?.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  init();
})();
