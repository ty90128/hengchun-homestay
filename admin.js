/**
 * admin.js｜恆春民宿管理後台
 *
 * 功能索引：
 * 01. Supabase 初始化與共用工具
 * 02. 登入、註冊與忘記密碼
 * 03. 全域狀態與表單欄位
 * 04. 管理員權限與登入狀態
 * 05. 民宿類型、設施與相簿排序
 * 06. 民宿清單、編輯視窗與拖曳排序
 * 07. 圖片上傳與 Banner 管理
 * 08. 民宿儲存、封面與相簿管理
 * 09. 首頁文字設定
 * 10. 後台分頁切換
 * 11. 價格備註管理
 * 12. 訂房須知管理
 * 13. 聯絡方式管理
 * 14. 共用拖曳排序
 *
 * 備註：
 * - 保留原有資料表名稱、DOM ID、功能邏輯與顯示文字。
 * - 僅整理縮排、換行、區段與註解。
 */

(() => {
  // ============================================================
  // 1. 初始化與共用工具
  // ============================================================
  const cfg = window.APP_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes("PASTE_") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const hint = document.getElementById("setupHint");

  if (!configured) {
    hint.textContent = "尚未設定 Supabase。請先依 README 修改 config.js。";
    return;
  }

  const db = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);

  function generateSlug(name = "") {
    const timestamp = Date.now();

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return slug || `stay-${timestamp}`;
  }

  // ============================================================
  // 2. 登入頁：密碼顯示與忘記密碼
  // ============================================================
  // 顯示／隱藏密碼
  const passwordToggle = $("passwordToggle");
  if (passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const passwordInput = $("password");
      if (!passwordInput) return;

      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      passwordToggle.textContent = isHidden ? "隱藏" : "顯示";
      passwordToggle.setAttribute(
        "aria-label",
        isHidden ? "隱藏密碼" : "顯示密碼",
      );
    });
  }

  // 忘記密碼
  $("forgotPasswordBtn").addEventListener("click", async () => {
    const email = $("email").value.trim();

    if (!email) {
      alert("請先輸入註冊時使用的 Email。");
      $("email").focus();
      return;
    }

    const button = $("forgotPasswordBtn");
    button.disabled = true;
    button.textContent = "寄送中…";

    try {
      const redirectTo = `${window.location.origin}/reset-password.html`;

      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      alert("重設密碼信已寄出，請到信箱查看。");
    } catch (error) {
      alert(`重設密碼信寄送失敗：${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "忘記密碼？";
    }
  });

  $("addRoomTypeRowBtn")?.addEventListener("click", () => {
  roomTypeRows.push({
    name: "",
    count: 1
  });

  renderRoomTypeRows();
});

  $("roomTypeRows")?.addEventListener("input", event => {
    const nameInput = event.target.closest("[data-room-name]");
    const countInput = event.target.closest("[data-room-count]");

    if (nameInput) {
      const index = Number(nameInput.dataset.roomName);
      roomTypeRows[index].name = nameInput.value;
    }

    if (countInput) {
      const index = Number(countInput.dataset.roomCount);
      roomTypeRows[index].count = Number(countInput.value) || 1;
    }

    updateRoomTypesValue();
  });

  $("roomTypeRows")?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-room]");

    if (!button) {
      return;
    }

    const index = Number(button.dataset.deleteRoom);

    roomTypeRows.splice(index, 1);
    renderRoomTypeRows();
  });
  // ============================================================
  // 3. 全域狀態與欄位設定
  // ============================================================
  let currentUser = null;
  let stays = [];
  let settings = [];
  let editing = null;
  let contactLinkSortable = null;

  let facilityOptions = [];
  let stayTypeOptions = [];
  let selectedFacilityIds = [];

  let priceNotes = [];
  let bookingNotices = [];
  let contactLinks = [];
  let stayTypeSortable = null;
  let activeGalleryCategory = "day";
  let gallerySortable = null;
  let facilitySortable = null;
  let roomTypeRows = [];
  $("name").addEventListener("input", () => {
    if (!editing) {
      $("slug").value = generateSlug($("name").value);
    }
  });
  const fields = [
    "no_label",
    "sort_order",
    "name",
    "slug",
    "label",
    "capacity",
    "room_types",
    "address",
    "checkin",
    "checkout",
    "security_deposit",
    "booking_deposit",
    "extra_bed",
    "high_season_price",
    "low_season_price",
    "note",
    "is_published",
  ];
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2400);
  }
  function safeName(name) {
    return name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  }
  function renderRoomTypeRows() {
    const container = $("roomTypeRows");

    container.innerHTML = roomTypeRows
      .map(
        (item, index) => `
          <div class="room-type-row" data-room-index="${index}">
            <input
              type="text"
              value="${escapeHtml(item.name || "")}"
              placeholder="例如：四人房"
              data-room-name="${index}"
            >

            <input
              type="number"
              min="1"
              value="${item.count || 1}"
              data-room-count="${index}"
            >

            <button
              type="button"
              class="danger"
              data-delete-room="${index}"
            >
              刪除
            </button>
          </div>
        `
      )
      .join("");

    updateRoomTypesValue();
  }

  function updateRoomTypesValue() {
    $("room_types").value = roomTypeRows
      .filter(item => item.name.trim())
      .map(item => `${item.name.trim()} ×${item.count}`)
      .join("、");
  }

  function parseRoomTypes(value = "") {
    if (!value.trim()) {
      return [];
    }

    return value
      .split("、")
      .map(part => {
        const match = part.trim().match(/^(.*?)\s*[×xX]\s*(\d+)$/);

        return {
          name: match ? match[1].trim() : part.trim(),
          count: match ? Number(match[2]) : 1
        };
      });
  }
  // ============================================================
  // 4. 管理員驗證與登入狀態
  // ============================================================
  async function isAdmin() {
    const { data, error } = await db
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUser.id)
      .single();
    return !error && data?.is_admin;
  }
  async function showSession(session) {
    if (!session || !session.user) {
      $("authView").hidden = false;
      $("adminView").hidden = true;
      return;
    }

    currentUser = session.user;

    const admin = await isAdmin();

    if (!admin) {
      alert("帳號登入成功，但未取得管理員權限。");
      await db.auth.signOut();

      $("authView").hidden = false;
      $("adminView").hidden = true;
      return;
    }

    $("authView").hidden = true;
    $("adminView").hidden = false;
    $("userEmail").textContent = currentUser.email || "";

    try {
      await Promise.all([
        loadStays(),
        loadSettings(),
        loadPriceNotes(),
        loadBookingNotices(),
        loadContactLinks(),
        loadFacilityOptions(),
        loadStayTypeOptions(),
      ]);
    } catch (error) {
      console.error("後台資料載入失敗：", error);
      alert(`登入成功，但後台資料載入失敗：${error.message}`);
    }
  }
  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const loginBtn = $("loginBtn");
    loginBtn.disabled = true;
    loginBtn.textContent = "登入中…";

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value,
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error("登入成功，但沒有取得登入狀態。");
      }

      await showSession(data.session);
    } catch (error) {
      alert(error.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "登入";
    }
  });
  $("signupBtn").addEventListener("click", async () => {
    const email = $("email").value,
      password = $("password").value;
    if (!email || password.length < 8) {
      alert("請輸入 Email，密碼至少 8 碼。");
      return;
    }
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) return alert(error.message);
    alert(
      data.session
        ? "註冊完成，已登入。"
        : "註冊完成。若 Supabase 有開啟 Email 驗證，請先至信箱確認。",
    );
  });
  $("logoutBtn").addEventListener("click", () => db.auth.signOut());
  db.auth.onAuthStateChange((_e, session) =>
    setTimeout(() => showSession(session), 0),
  );
  db.auth.getSession().then(({ data }) => showSession(data.session));
  // ============================================================
  // 5. 設施選項與民宿設施關聯
  // ============================================================
  async function loadFacilityOptions() {
    const { data, error } = await db
      .from("facility_options")
      .select("*")
      .order("sort_order");

    if (error) {
      alert(`設施載入失敗：${error.message}`);
      return;
    }

    facilityOptions = data || [];

    renderFacilityCheckboxes();
    renderFacilityManager();
  }

  async function loadStayTypeOptions() {
    const { data, error } = await db
      .from("stay_type_options")
      .select("*")
      .order("sort_order");

    if (error) {
      alert(`類型載入失敗：${error.message}`);
      return;
    }

    stayTypeOptions = data || [];

    renderStayTypeSelect();

    const manager = $("stayTypeManager");

    if (manager && !manager.hidden) {
      renderStayTypeManager();
    }
  }
  function initGallerySortable() {
    const container = $("adminGallery");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (gallerySortable) {
      gallerySortable.destroy();
    }

    gallerySortable = Sortable.create(container, {
      animation: 180,
      handle: ".photo-drag-handle",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",

      onEnd: async () => {
        await saveGalleryOrder();
      },
    });
  }
  async function saveGalleryOrder() {
    const items = [
      ...$("adminGallery").querySelectorAll("[data-gallery-image-id]"),
    ];

    const counters = {
      day: 0,
      night: 0,
      room: 0,
    };

    const imageMap = new Map(
      (editing?.stay_images || []).map((image) => [image.id, image]),
    );

    const updates = items.map((item) => {
      const id = item.dataset.galleryImageId;
      const image = imageMap.get(id);
      const category = image?.category || "day";

      counters[category] = (counters[category] || 0) + 1;

      return {
        id,
        sort_order: counters[category],
      };
    });

    try {
      await Promise.all(
        updates.map(async (row) => {
          const { error } = await db
            .from("stay_images")
            .update({
              sort_order: row.sort_order,
            })
            .eq("id", row.id);

          if (error) {
            throw error;
          }
        }),
      );

      toast("照片順序已更新");

      await loadStays();

      editing = stays.find((stay) => stay.id === editing?.id);

      if (editing) {
        renderGallery(editing);
      }
    } catch (error) {
      alert(`照片排序失敗：${error.message}`);
    }
  }
  function renderStayTypeSelect() {
    const select = $("label");

    if (!select) {
      return;
    }

    const currentValue = select.value;

    const options = stayTypeOptions
      .filter((item) => item.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    select.innerHTML = `
    <option value="">請選擇類型</option>
    ${options
      .map(
        (item) => `
      <option value="${escapeHtml(item.name)}">
        ${escapeHtml(item.name)}
      </option>
    `,
      )
      .join("")}
  `;

    if (currentValue && options.some((item) => item.name === currentValue)) {
      select.value = currentValue;
    }
  }
  const addStayTypeBtn = $("addStayTypeBtn");

  if (addStayTypeBtn) {
    addStayTypeBtn.addEventListener("click", async () => {
      const input = $("newStayTypeName");
      const name = input.value.trim();

      if (!name) {
        alert("請輸入類型名稱。");
        input.focus();
        return;
      }

      const duplicate = stayTypeOptions.some(
        (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
      );

      if (duplicate) {
        alert("這個類型已經存在。");
        return;
      }

      addStayTypeBtn.disabled = true;
      addStayTypeBtn.textContent = "新增中…";

      try {
        const { error } = await db.from("stay_type_options").insert({
          name,
          sort_order: stayTypeOptions.length + 1,
          is_active: true,
        });

        if (error) {
          throw error;
        }

        input.value = "";

        await loadStayTypeOptions();

        $("label").value = name;

        toast("類型已新增");
      } catch (error) {
        alert(`新增失敗：${error.message}`);
      } finally {
        addStayTypeBtn.disabled = false;
        addStayTypeBtn.textContent = "＋新增類型";
      }
    });
  }
  function renderStayTypeManager() {
    const container = $("stayTypeOptionList");

    if (!container) {
      return;
    }

    container.innerHTML =
      stayTypeOptions
        .map(
          (item) => `
      <article
        class="stay-type-manage-item"
        data-stay-type-id="${item.id}"
      >
        <button
          type="button"
          class="drag-handle"
          title="拖曳調整順序"
        >
          ☰
        </button>

        <label class="checkbox">
          <input
            type="checkbox"
            data-stay-type-active="${item.id}"
            ${item.is_active ? "checked" : ""}
          >
          啟用
        </label>

        <label>
          排序
          <input
            type="number"
            min="1"
            value="${item.sort_order}"
            data-stay-type-order="${item.id}"
          >
        </label>

        <label class="stay-type-name-field">
          類型名稱
          <input
            type="text"
            value="${escapeHtml(item.name)}"
            data-stay-type-name="${item.id}"
          >
        </label>

        <button
          type="button"
          data-save-stay-type="${item.id}"
        >
          儲存
        </button>

        <button
          type="button"
          class="danger"
          data-delete-stay-type="${item.id}"
        >
          刪除
        </button>
      </article>
    `,
        )
        .join("") || "<p>目前尚無類型。</p>";

    initStayTypeSortable();
  }
  $("stayTypeOptionList")?.addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-save-stay-type]");

    const deleteButton = event.target.closest("[data-delete-stay-type]");

    if (saveButton) {
      const id = saveButton.dataset.saveStayType;

      const name = document
        .querySelector(`[data-stay-type-name="${id}"]`)
        .value.trim();

      const sortOrder = Number(
        document.querySelector(`[data-stay-type-order="${id}"]`).value,
      );

      const isActive = document.querySelector(
        `[data-stay-type-active="${id}"]`,
      ).checked;

      if (!name) {
        alert("請輸入類型名稱。");
        return;
      }

      const oldItem = stayTypeOptions.find((item) => item.id === id);

      const { error } = await db
        .from("stay_type_options")
        .update({
          name,
          sort_order: sortOrder,
          is_active: isActive,
        })
        .eq("id", id);

      if (error) {
        alert(`儲存失敗：${error.message}`);
        return;
      }

      /*
       * 如果類型名稱被修改，
       * 同步更新所有正在使用舊名稱的民宿。
       */
      if (oldItem && oldItem.name !== name) {
        const { error: stayError } = await db
          .from("stays")
          .update({ label: name })
          .eq("label", oldItem.name);

        if (stayError) {
          alert(`類型已更新，但民宿同步失敗：${stayError.message}`);
          return;
        }
      }

      toast("類型已更新");
      await Promise.all([loadStayTypeOptions(), loadStays()]);
    }

    if (deleteButton) {
      const id = deleteButton.dataset.deleteStayType;

      const item = stayTypeOptions.find((option) => option.id === id);

      if (!confirm(`確定刪除「${item?.name || "這個類型"}」？`)) {
        return;
      }

      /*
       * 建議先確認是否有民宿正在使用，
       * 避免刪除後民宿仍保留舊文字。
       */
      const { count, error: countError } = await db
        .from("stays")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("label", item.name);

      if (countError) {
        alert(countError.message);
        return;
      }

      if (count > 0) {
        alert(`目前有 ${count} 間民宿使用這個類型，請先更換民宿類型後再刪除。`);
        return;
      }

      const { error } = await db
        .from("stay_type_options")
        .delete()
        .eq("id", id);

      if (error) {
        alert(`刪除失敗：${error.message}`);
        return;
      }

      toast("類型已刪除");
      await loadStayTypeOptions();
    }
  });
  function initStayTypeSortable() {
    const container = $("stayTypeOptionList");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (stayTypeSortable) {
      stayTypeSortable.destroy();
    }

    stayTypeSortable = Sortable.create(container, {
      animation: 180,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",

      onEnd: async () => {
        await saveDraggedOrder({
          container,
          table: "stay_type_options",
          itemSelector: "[data-stay-type-id]",
          idAttribute: "stayTypeId",
          orderInputAttribute: "data-stay-type-order",
          reload: loadStayTypeOptions,
        });
      },
    });
  }
  function renderFacilityCheckboxes() {
    const container = $("facilityCheckboxList");

    if (!container) {
      return;
    }

    const options = facilityOptions
      .filter((item) => item.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    container.innerHTML = options
      .map(
        (item) => `
    <label class="facility-option">
      <input
        type="checkbox"
        value="${item.id}"
        data-facility-checkbox
        ${selectedFacilityIds.includes(item.id) ? "checked" : ""}
      >
      <span>${escapeHtml(item.name)}</span>
    </label>
  `,
      )
      .join("");
  }

  async function loadSelectedFacilities(stayId) {
    selectedFacilityIds = [];

    if (!stayId) {
      renderFacilityCheckboxes();
      return;
    }

    const { data, error } = await db
      .from("stay_facilities")
      .select("facility_id")
      .eq("stay_id", stayId);

    if (error) {
      alert(`民宿設施載入失敗：${error.message}`);
      return;
    }

    selectedFacilityIds = (data || []).map((item) => item.facility_id);

    renderFacilityCheckboxes();
  }

  async function saveStayFacilities(stayId) {
    const selectedIds = [
      ...document.querySelectorAll("[data-facility-checkbox]:checked"),
    ].map((input) => input.value);

    const { error: deleteError } = await db
      .from("stay_facilities")
      .delete()
      .eq("stay_id", stayId);

    if (deleteError) {
      throw deleteError;
    }

    if (!selectedIds.length) {
      return;
    }

    const rows = selectedIds.map((facilityId) => ({
      stay_id: stayId,
      facility_id: facilityId,
    }));

    const { error: insertError } = await db
      .from("stay_facilities")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }
  // ============================================================
  // 6. 民宿清單、拖曳排序與編輯視窗
  // ============================================================
  async function loadStays() {
    const { data, error } = await db
      .from("stays")
      .select("*,stay_images(*)")
      .order("sort_order");
    if (error) return alert(error.message);
    stays = data || [];
    renderStays();
  }

  const formatPrice = (value, slug = "") => {
    const safe = esc(value || "");
    return slug === "lijing"
      ? safe
      : safe.replaceAll("、", "\n");
  };

  function getCardTime(value = "") {
    const text = String(value).trim();

    if (!text) {
      return "";
    }

    return text
      .split(/\r?\n/)[0]
      .split("※")[0]
      .split(/[（(]/)[0]
      .trim();
  }

  function renderStays() {
    $("stayList").innerHTML =
      stays
        .map(
          (s) => `
    <article
      class="admin-stay-card"
      data-stay-id="${s.id}"
    >
      <button
        type="button"
        class="drag-handle"
        aria-label="拖曳調整順序"
        title="拖曳調整順序"
      >
        ☰
      </button>

      <img
        src="${s.cover_image_url || "assets/hengchun-main-banner.png"}"
        alt="${s.name}"
      >

      <div>
        <h3>${s.no_label}｜${s.name}</h3>

        <p>
          ${s.capacity || ""}・${s.room_types || ""}
        </p>

        <span class="status ${s.is_published ? "" : "off"}">
          ${s.is_published ? "已上架" : "已下架"}
        </span>

        <small>
          排序：${s.sort_order}
        </small>
      </div>

      <button data-edit="${s.id}">
        編輯
      </button>
    </article>
  `,
        )
        .join("") || "<p>尚無民宿，請新增第一間。</p>";

    initStaySortable();
  }
  let staySortable = null;

  function initStaySortable() {
    const container = $("stayList");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (staySortable) {
      staySortable.destroy();
    }

    staySortable = Sortable.create(container, {
      animation: 180,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",

      onEnd: async () => {
        await saveDraggedOrder({
          container,
          table: "stays",
          itemSelector: "[data-stay-id]",
          idAttribute: "stayId",
          orderInputAttribute: "data-unused-order",
          reload: loadStays,
        });
      },
    });
  }
  $("stayList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit]");
    if (b) openEdit(stays.find((s) => s.id === b.dataset.edit));
  });
  $("newStayBtn").addEventListener("click", () => openEdit(null));
  async function openEdit(s) {
    editing = s || null;

    $("editTitle").textContent = s ? "編輯民宿" : "新增民宿";
    const preview = $("coverPreview");
    const empty = $("coverEmpty");

    if (s?.cover_image_url) {
      preview.src = s.cover_image_url;
      preview.hidden = false;
      empty.hidden = true;
    } else {
      preview.hidden = true;
      preview.removeAttribute("src");
      empty.hidden = false;
    }
    $("stayForm").reset();
    $("stayId").value = s?.id || "";

    fields.forEach((field) => {
      const element = $(field);

      if (!element) {
        return;
      }

      if (element.type === "checkbox") {
        element.checked = s ? Boolean(s[field]) : true;
      } else {
        const defaultValues = {
           checkin:
            "下午3點（After 3 PM）",

          checkout:
            "上午11:00（Before 11 AM）\n" +
            "※ 如需要加時間請提前告知 ※",

          note:
            "以上報價不適用於春節、音樂祭、特殊節日。\n" +
            "農曆春節、特殊假日及連假期間：價格另計。",

          extra_bed:
            "☒ / ☑ 平日$800/人、連續假日$1000/人"
        };

        element.value =
          s?.[field] ??
          (field === "sort_order"
            ? stays.length + 1
            : defaultValues[field] || "");
      }
    });

    const securityAmount =
      $("security_deposit_amount").value.trim();

    const bookingPercent =
      $("booking_deposit_percent").value.trim();


    if (s) {
      const securityMatch = String(s.security_deposit || "")
        .match(/\$?([\d,]+)/);

      $("security_deposit_amount").value =
        securityMatch
          ? securityMatch[1].replace(/,/g, "")
          : "";

      const bookingMatch = String(s.booking_deposit || "")
        .match(/(\d+)%/);

      $("booking_deposit_percent").value =
        bookingMatch
          ? bookingMatch[1]
          : "";
    } else {
      $("security_deposit_amount").value = "15000";
      $("booking_deposit_percent").value = "50";
    }
    // ============================================================
    // 解析訂房訂金：比例或固定金額
    // ============================================================
    if (s) {
      const bookingText = String(
        s.booking_deposit || ""
      );

      const percentMatch =
        bookingText.match(/(\d+)\s*%/);

      const fixedMatch =
        bookingText.match(
          /固定訂金\s*\$?\s*([\d,]+)/
        );

      if (percentMatch) {
        $("booking_deposit_type").value = "percent";
        $("booking_deposit_percent").value =
          percentMatch[1];

        $("booking_deposit_amount").value = "";
      } else if (fixedMatch) {
        $("booking_deposit_type").value = "fixed";
        $("booking_deposit_amount").value =
          fixedMatch[1].replace(/,/g, "");

        $("booking_deposit_percent").value = "";
      } else {
        $("booking_deposit_type").value = "percent";
        $("booking_deposit_percent").value = "50";
        $("booking_deposit_amount").value = "";
      }
    } else {
      // 新增民宿預設為比例制 50%
      $("booking_deposit_type").value = "percent";
      $("booking_deposit_percent").value = "50";
      $("booking_deposit_amount").value = "";
    }

    // 根據類型顯示正確欄位
    updateBookingDepositFields();

    roomTypeRows = parseRoomTypes(s?.room_types || "");

    if (!roomTypeRows.length && !s) {
      roomTypeRows = [
        { name: "雙人房", count: 1 },
        { name: "四人房", count: 1 }
      ];
    }

    renderRoomTypeRows();

    $("deleteStayBtn").style.visibility = s ? "visible" : "hidden";

    $("galleryManager").hidden = !s;
    $("gallerySaveHint").hidden = Boolean(s);
    if (s) {
      $("galleryManager").hidden = false;
      $("gallerySaveHint").hidden = true;

      activeGalleryCategory = "day";
      renderGallery(s);
    } else {
      $("galleryManager").hidden = true;
      $("gallerySaveHint").hidden = false;
    }

    await loadSelectedFacilities(s?.id);

    const manager = $("facilityManager");

    if (manager) {
      manager.hidden = true;
    }

    const stayTypeManager = $("stayTypeManager");

    if (stayTypeManager) {
      stayTypeManager.hidden = true;
    }

    const toggleButton = $("toggleStayTypeManagerBtn");

    if (toggleButton) {
      toggleButton.textContent = "管理類型";
    }

    $("editModal").hidden = false;
  }
  function closeEdit() {
    $("editModal").hidden = true;
    editing = null;
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-edit]")) closeEdit();
  });

  const toggleStayTypeManagerBtn = $("toggleStayTypeManagerBtn");

  if (toggleStayTypeManagerBtn) {
    toggleStayTypeManagerBtn.addEventListener("click", () => {
      const manager = $("stayTypeManager");

      if (!manager) {
        console.error("找不到類型管理區塊：#stayTypeManager");
        return;
      }

      manager.hidden = !manager.hidden;

      toggleStayTypeManagerBtn.textContent = manager.hidden
        ? "管理類型"
        : "收合類型管理";

      if (!manager.hidden) {
        renderStayTypeManager();
      }
    });
  }
  // ============================================================
  // 7. 圖片上傳與 Banner 管理
  // ============================================================
  async function uploadFile(file, folder) {
    const path = `${folder}/${Date.now()}-${safeName(file.name)}`;
    const { error } = await db.storage
      .from("homestay-images")
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return db.storage.from("homestay-images").getPublicUrl(path).data.publicUrl;
  }
  $("uploadBannerBtn").addEventListener("click", async () => {
    const file = $("bannerFile").files[0];

    if (!file) {
      alert("請先選擇 Banner 圖片。");
      return;
    }

    const button = $("uploadBannerBtn");
    button.disabled = true;
    button.textContent = "上傳中…";

    try {
      const imageUrl = await uploadFile(file, "site/banner");

      const { error } = await db.from("site_settings").upsert(
        {
          key: "hero_image_url",
          value: imageUrl,
        },
        {
          onConflict: "key",
        },
      );

      if (error) {
        throw error;
      }

      $("bannerPreview").src = imageUrl;
      $("bannerFile").value = "";

      toast("Banner 已更新");
    } catch (error) {
      alert(`Banner 上傳失敗：${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "上傳並更換 Banner";
    }
  });
  // ============================================================
  // 8. 民宿儲存、刪除與相簿管理
  // ============================================================
  $("stayForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const saveBtn = event.submitter;
    const originalText = saveBtn.textContent;

    saveBtn.disabled = true;
    saveBtn.textContent = "儲存中…";

    try {
      const isEdit = Boolean(editing);

      const row = {};

      fields.forEach((field) => {
        const element = $(field);

        if (!element) {
          console.warn(`找不到表單欄位：#${field}`);
          return;
        }

        if (element.type === "checkbox") {
          row[field] = element.checked;
        } else if (field === "sort_order") {
          row[field] = Number(element.value);
        } else {
          row[field] = element.value.trim();
        }
      });

      // ============================================================
      // 組合入住押金與訂房訂金完整文字
      // ============================================================
      const securityAmount =
        $("security_deposit_amount").value.trim();

      row.security_deposit = securityAmount
        ? `$${securityAmount}（退房時確認無蓄意破壞、室內抽菸等行徑，會全額退還的唷~）`
        : "";

      const bookingType =
        $("booking_deposit_type").value;

      const bookingPercent =
        $("booking_deposit_percent").value.trim();

      const bookingAmount =
        $("booking_deposit_amount").value.trim();

      if (bookingType === "percent") {
        row.booking_deposit = bookingPercent
          ? `訂房價格的${bookingPercent}%（完成匯款後才算保留房間）`
          : "";
      } else {
        row.booking_deposit = bookingAmount
          ? `固定訂金 $${bookingAmount}（完成匯款後才算保留房間）`
          : "";
      }

      if (!row.slug) {
        row.slug = generateSlug(row.name);
      }

      const file = $("coverFile").files[0];

      if (file) {
        row.cover_image_url = await uploadFile(
          file,
          `covers/${row.slug || "stay"}`,
        );
      }

      let result;

      if (editing) {
        result = await db
          .from("stays")
          .update(row)
          .eq("id", editing.id)
          .select()
          .single();
      } else {
        result = await db.from("stays").insert(row).select().single();
      }

      if (result.error) {
        throw result.error;
      }

      await saveStayFacilities(result.data.id);

      await loadStays();

      editing = stays.find((stay) => stay.id === result.data.id);

      if (!editing) {
        throw new Error("民宿已儲存，但重新載入資料失敗。");
      }

      $("stayId").value = editing.id;
      $("editTitle").textContent = "編輯民宿";
      $("deleteStayBtn").style.visibility = "visible";

      $("gallerySaveHint").hidden = true;
      $("galleryManager").hidden = false;

      activeGalleryCategory = "day";
      renderGallery(editing);

      if (isEdit) {
        toast("✅ 民宿資料已更新");
      } else {
        toast("🎉 民宿新增完成，現在可以上傳相簿照片");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;

    }
  });
  $("coverFile").addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (!file) return;

    $("coverPreview").src = URL.createObjectURL(file);

    $("coverPreview").hidden = false;
    $("coverEmpty").hidden = true;
  });
  $("addFacilityBtn")?.addEventListener("click", async () => {
    const name = $("newFacilityName").value.trim();

    if (!name) {
      alert("請輸入設施名稱。");
      return;
    }

    const { error } = await db.from("facility_options").insert({
      name,
      sort_order: facilityOptions.length + 1,
      is_active: true,
    });

    if (error) {
      alert(`新增失敗：${error.message}`);
      return;
    }

    $("newFacilityName").value = "";

    toast("設施已新增");
    await loadFacilityOptions();
  });

  $("toggleFacilityManagerBtn")?.addEventListener("click", () => {
    const manager = $("facilityManager");

    manager.hidden = !manager.hidden;

    $("toggleFacilityManagerBtn").textContent = manager.hidden
      ? "管理設施"
      : "收合設施管理";
  });
  function renderFacilityManager() {
    const container = $("facilityOptionList");

    if (!container) {
      return;
    }

    container.innerHTML = facilityOptions
      .map(
        (item) => `
      <article
        class="facility-manage-item"
        data-facility-id="${item.id}"
      >
        <button
          type="button"
          class="drag-handle"
          title="拖曳調整順序"
        >
          ☰
        </button>

        <label class="checkbox">
          <input
            type="checkbox"
            data-facility-active="${item.id}"
            ${item.is_active ? "checked" : ""}
          >
          啟用
        </label>

        <input
          type="number"
          value="${item.sort_order}"
          data-facility-order="${item.id}"
          aria-label="排序"
        >

        <input
          type="text"
          value="${escapeHtml(item.name)}"
          data-facility-name="${item.id}"
        >

        <button
          type="button"
          data-save-facility="${item.id}"
        >
          儲存
        </button>

        <button
          type="button"
          class="danger"
          data-delete-facility="${item.id}"
        >
          刪除
        </button>
      </article>
    `,
      )
      .join("");

    initFacilitySortable();
  }
  $("deleteStayBtn").addEventListener("click", async () => {
    if (!editing || !confirm(`確定刪除「${editing.name}」？相簿資料也會刪除。`))
      return;
    const { error } = await db.from("stays").delete().eq("id", editing.id);
    if (error) return alert(error.message);
    toast("民宿已刪除");
    closeEdit();
    await loadStays();
  });
  function initFacilitySortable() {
    const container = $("facilityOptionList");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (facilitySortable) {
      facilitySortable.destroy();
    }

    facilitySortable = Sortable.create(container, {
      animation: 180,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",

      onEnd: async () => {
        await saveDraggedOrder({
          container,
          table: "facility_options",
          itemSelector: "[data-facility-id]",
          idAttribute: "facilityId",
          orderInputAttribute: "data-facility-order",
          reload: loadFacilityOptions,
        });
      },
    });
  }
  $("facilityOptionList")?.addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-save-facility]");

    const deleteButton = event.target.closest("[data-delete-facility]");

    if (saveButton) {
      const id = saveButton.dataset.saveFacility;

      const name = document
        .querySelector(`[data-facility-name="${id}"]`)
        .value.trim();

      const sortOrder = Number(
        document.querySelector(`[data-facility-order="${id}"]`).value,
      );

      const isActive = document.querySelector(
        `[data-facility-active="${id}"]`,
      ).checked;

      if (!name) {
        alert("請輸入設施名稱。");
        return;
      }

      const { error } = await db
        .from("facility_options")
        .update({
          name,
          sort_order: sortOrder,
          is_active: isActive,
        })
        .eq("id", id);

      if (error) {
        alert(`儲存失敗：${error.message}`);
        return;
      }

      toast("設施已更新");
      await loadFacilityOptions();
    }

    if (deleteButton) {
      const id = deleteButton.dataset.deleteFacility;

      const confirmed = confirm(
        "刪除後，所有民宿與此設施的關聯也會移除，確定刪除？",
      );

      if (!confirmed) {
        return;
      }

      const { error } = await db.from("facility_options").delete().eq("id", id);

      if (error) {
        alert(`刪除失敗：${error.message}`);
        return;
      }

      selectedFacilityIds = selectedFacilityIds.filter(
        (facilityId) => facilityId !== id,
      );

      toast("設施已刪除");
      await loadFacilityOptions();
    }
  });
  function getGalleryCategoryLabel(category) {
    const labels = {
      day: "公共區域｜白天",
      night: "公共區域｜夜景",
      room: "房間照片",
    };

    return labels[category] || category;
  }
  function renderGallery(stay) {
    const container = $("adminGallery");

    if (!container) {
      return;
    }

    const images = (stay?.stay_images || [])
      .filter((image) => image.category === activeGalleryCategory)
      .sort((a, b) => a.sort_order - b.sort_order);

    const label = $("currentGalleryCategoryLabel");

    if (label) {
      label.textContent = getGalleryCategoryLabel(activeGalleryCategory);
    }

    document.querySelectorAll("[data-gallery-category]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.galleryCategory === activeGalleryCategory,
      );
    });

    container.innerHTML =
      images
        .map(
          (image) => `
      <div
        class="admin-photo"
        data-gallery-image-id="${image.id}"
      >
        <button
          type="button"
          class="photo-drag-handle"
          title="拖曳調整照片順序"
          aria-label="拖曳調整照片順序"
        >
          ☰
        </button>

        <img
          src="${escapeHtml(image.image_url)}"
          alt="${escapeHtml(getGalleryCategoryLabel(image.category))}"
        >

        <button
          type="button"
          class="photo-delete-button"
          data-del-img="${image.id}"
          title="刪除照片"
          aria-label="刪除照片"
        >
          ×
        </button>

        <small>
          排序 ${image.sort_order}
        </small>
      </div>
    `,
        )
        .join("") ||
      `<p class="gallery-empty">
      此分類目前沒有照片。
    </p>`;

    initGallerySortable();
  }
  $("galleryTabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gallery-category]");

    if (!button || !editing) {
      return;
    }

    activeGalleryCategory = button.dataset.galleryCategory;

    renderGallery(editing);
  });
  $("adminGallery").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del-img]");
    if (!b || !confirm("確定刪除這張照片？")) return;
    const { error } = await db
      .from("stay_images")
      .delete()
      .eq("id", b.dataset.delImg);
    if (error) return alert(error.message);
    toast("照片已刪除");
    await loadStays();
    editing = stays.find((s) => s.id === editing.id);
    renderGallery(editing);
  });

  $("uploadGalleryBtn")?.addEventListener("click", async () => {
    const button = $("uploadGalleryBtn");
    const fileInput = $("galleryFiles");

    if (!editing?.id) {
      alert("尚未取得民宿資料，請先儲存民宿。");
      return;
    }

    if (!fileInput) {
      alert("找不到相簿照片欄位。");
      return;
    }

    const files = Array.from(fileInput.files || []);

    if (files.length === 0) {
      alert("請先選擇要上傳的照片。");
      return;
    }

    const category = activeGalleryCategory || "day";

    button.disabled = true;
    button.textContent = `上傳中 0/${files.length}`;

    try {
      const categoryImages = (editing.stay_images || []).filter(
        (image) => image.category === category
      );

      const rows = [];

      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        button.textContent =
          `上傳中 ${index + 1}/${files.length}`;

        const imageUrl = await uploadFile(
          file,
          `galleries/${editing.slug || editing.id}/${category}`
        );

        rows.push({
          stay_id: editing.id,
          category,
          image_url: imageUrl,
          sort_order: categoryImages.length + index + 1
        });
      }

      const { error: insertError } = await db
        .from("stay_images")
        .insert(rows);

      if (insertError) {
        throw insertError;
      }

      fileInput.value = "";

      await loadStays();

      editing = stays.find(
        (stay) => stay.id === editing.id
      );

      if (!editing) {
        throw new Error("照片已上傳，但重新載入民宿資料失敗。");
      }

      renderGallery(editing);

      toast(
        `✅ ${getGalleryCategoryLabel(category)}照片上傳成功`
      );
    } catch (error) {
      console.error("相簿照片上傳失敗：", error);

      alert(
        `相簿照片上傳失敗：${error.message || "未知錯誤"}`
      );
    } finally {
      button.disabled = false;
      button.textContent = "上傳至目前分類";
    }
  });

  function initGallerySortable() {
    const container = $("adminGallery");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (gallerySortable) {
      gallerySortable.destroy();
    }

    gallerySortable = Sortable.create(container, {
      animation: 180,
      handle: ".photo-drag-handle",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",

      onEnd: async () => {
        await saveCurrentGalleryOrder();
      },
    });
  }
  async function saveCurrentGalleryOrder() {
    const items = [
      ...$("adminGallery").querySelectorAll("[data-gallery-image-id]"),
    ];

    if (!items.length) {
      return;
    }

    try {
      const updates = items.map((item, index) => ({
        id: item.dataset.galleryImageId,
        sort_order: index + 1,
      }));

      await Promise.all(
        updates.map(async (row) => {
          const { error } = await db
            .from("stay_images")
            .update({
              sort_order: row.sort_order,
            })
            .eq("id", row.id);

          if (error) {
            throw error;
          }
        }),
      );

      toast(`${getGalleryCategoryLabel(activeGalleryCategory)}排序已更新`);

      await loadStays();

      editing = stays.find((stay) => stay.id === editing?.id);

      if (editing) {
        renderGallery(editing);
      }
    } catch (error) {
      alert(`照片排序失敗：${error.message}`);
    }
  }
  // ============================================================
  // 9. 首頁與聯絡區文字設定
  // ============================================================
  const settingLabels = {
    intro_title: "首頁簡介標題",
    intro_p1: "首頁簡介第一段",
    intro_p2: "首頁簡介第二段",
    contact_title: "聯絡區標題",
    contact_text: "聯絡區說明",
  };
  async function loadSettings() {
    const { data, error } = await db
      .from("site_settings")
      .select("*")
      .order("key");
    if (error) return alert(error.message);
    settings = data || [];
    $("settingsForm").innerHTML = Object.entries(settingLabels)
      .map(([key, label]) => {
        const value = settings.find((x) => x.key === key)?.value || "";
        const multi =
          key.includes("_p") ||
          key.includes("note") ||
          key.includes("body") ||
          key === "contact_text";
        return `<label class="${multi ? "wide" : ""}">${label}${multi ? `<textarea data-setting="${key}" rows="3">${value}</textarea>` : `<input data-setting="${key}" value="${String(value).replace(/"/g, "&quot;")}">`}</label>`;
      })
      .join("");
    const bannerUrl =
      settings.find((item) => item.key === "hero_image_url")?.value ||
      "assets/hengchun-main-banner.png";

    $("bannerPreview").src = bannerUrl;
  }
  $("saveSettingsBtn").addEventListener("click", async () => {
    const rows = [...document.querySelectorAll("[data-setting]")].map((el) => ({
      key: el.dataset.setting,
      value: el.value,
    }));
    const { error } = await db
      .from("site_settings")
      .upsert(rows, { onConflict: "key" });
    if (error) return alert(error.message);
    toast("網站內容已儲存");
  });
  // ============================================================
  // 10. 後台分頁切換
  // ============================================================
  const tabSections = {
    stays: "staysTab",
    homepage: "homepageTab",
    "price-notes": "priceNotesTab",
    "booking-notices": "bookingNoticesTab",
    contacts: "contactsTab",
  };

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      Object.values(tabSections).forEach((sectionId) => {
        const section = $(sectionId);

        if (section) {
          section.hidden = true;
        }
      });

      const targetId = tabSections[button.dataset.tab];
      const targetSection = $(targetId);

      if (targetSection) {
        targetSection.hidden = false;
      }
    });
  });

  // ============================================================
  // 11. 價格備註 CRUD 與拖曳排序
  // ============================================================
  async function loadPriceNotes() {
    const { data, error } = await db
      .from("price_notes")
      .select("*")
      .order("sort_order");

    if (error) {
      alert(error.message);
      return;
    }

    priceNotes = data || [];
    renderPriceNotes();
  }

  function renderPriceNotes() {
    $("priceNoteList").innerHTML = priceNotes
      .map(
        (note) => `
      <article
        class="dynamic-item"
        data-price-id="${note.id}"
      >
        <button
          type="button"
          class="drag-handle"
          aria-label="拖曳調整順序"
        >
          ☰
        </button>

        <label class="checkbox">
          <input
            type="checkbox"
            data-price-visible="${note.id}"
            ${note.is_visible ? "checked" : ""}
          >
          前台顯示
        </label>

        <label>
          排序
          <input
            type="number"
            value="${note.sort_order}"
            data-price-order="${note.id}"
          >
        </label>

        <label class="wide">
          備註內容
          <textarea
            rows="3"
            data-price-content="${note.id}"
          >${note.content || ""}</textarea>
        </label>

        <div class="item-actions">
          <button
            type="button"
            data-save-price="${note.id}"
          >
            儲存
          </button>

          <button
            type="button"
            class="danger"
            data-delete-price="${note.id}"
          >
            刪除
          </button>
        </div>
      </article>
    `,
      )
      .join("");

    initPriceNoteSortable();
  }

  let priceNoteSortable = null;

  function initPriceNoteSortable() {
    const container = $("priceNoteList");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (priceNoteSortable) {
      priceNoteSortable.destroy();
    }

    priceNoteSortable = Sortable.create(container, {
      animation: 180,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",

      onEnd: async () => {
        await saveDraggedOrder({
          container,
          table: "price_notes",
          itemSelector: "[data-price-id]",
          idAttribute: "priceId",
          orderInputAttribute: "data-price-order",
          reload: loadPriceNotes,
        });
      },
    });
  }

  $("newPriceNoteBtn").addEventListener("click", async () => {
    const { error } = await db.from("price_notes").insert({
      content: "",
      is_visible: true,
      sort_order: priceNotes.length + 1,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadPriceNotes();
  });

  $("priceNoteList").addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-save-price]");
    const deleteButton = event.target.closest("[data-delete-price]");

    if (saveButton) {
      const id = saveButton.dataset.savePrice;

      const content = document.querySelector(
        `[data-price-content="${id}"]`,
      ).value;

      const sortOrder = Number(
        document.querySelector(`[data-price-order="${id}"]`).value,
      );

      const isVisible = document.querySelector(
        `[data-price-visible="${id}"]`,
      ).checked;

      const { error } = await db
        .from("price_notes")
        .update({
          content,
          sort_order: sortOrder,
          is_visible: isVisible,
        })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      toast("價格備註已儲存");
      await loadPriceNotes();
    }

    if (deleteButton) {
      const id = deleteButton.dataset.deletePrice;

      if (!confirm("確定刪除這則價格備註？")) {
        return;
      }

      const { error } = await db.from("price_notes").delete().eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      toast("價格備註已刪除");
      await loadPriceNotes();
    }
  });

  // ============================================================
  // 12. 訂房須知 CRUD 與拖曳排序
  // ============================================================
  async function loadBookingNotices() {
    const { data, error } = await db
      .from("booking_notices")
      .select("*")
      .order("sort_order");

    if (error) {
      alert(error.message);
      return;
    }

    bookingNotices = data || [];
    renderBookingNotices();
  }

  function renderBookingNotices() {
    $("bookingNoticeList").innerHTML = bookingNotices
      .map(
        (notice) => `
      <article
        class="dynamic-item"
        data-notice-id="${notice.id}"
      >
        <button
          type="button"
          class="drag-handle"
          aria-label="拖曳調整順序"
        >
          ☰
        </button>

        <label class="checkbox">
          <input
            type="checkbox"
            data-notice-visible="${notice.id}"
            ${notice.is_visible ? "checked" : ""}
          >
          前台顯示
        </label>

        <label>
          排序
          <input
            type="number"
            value="${notice.sort_order}"
            data-notice-order="${notice.id}"
          >
        </label>

        <label class="wide">
          標題
          <input
            value="${notice.title || ""}"
            data-notice-title="${notice.id}"
          >
        </label>

        <label class="wide">
          內容
          <textarea
            rows="4"
            data-notice-content="${notice.id}"
          >${notice.content || ""}</textarea>
        </label>

        <div class="item-actions">
          <button
            type="button"
            data-save-notice="${notice.id}"
          >
            儲存
          </button>

          <button
            type="button"
            class="danger"
            data-delete-notice="${notice.id}"
          >
            刪除
          </button>
        </div>
      </article>
    `,
      )
      .join("");

    initBookingNoticeSortable();
  }
  let bookingNoticeSortable = null;

  function initBookingNoticeSortable() {
    const container = $("bookingNoticeList");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (bookingNoticeSortable) {
      bookingNoticeSortable.destroy();
    }

    bookingNoticeSortable = Sortable.create(container, {
      animation: 180,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",

      onEnd: async () => {
        await saveDraggedOrder({
          container,
          table: "booking_notices",
          itemSelector: "[data-notice-id]",
          idAttribute: "noticeId",
          orderInputAttribute: "data-notice-order",
          reload: loadBookingNotices,
        });
      },
    });
  }
  // ============================================================
// 訂房訂金類型切換
// ============================================================
function updateBookingDepositFields() {
  const typeSelect = $("booking_deposit_type");
  const percentField = $("bookingDepositPercentField");
  const amountField = $("bookingDepositAmountField");

  if (!typeSelect || !percentField || !amountField) {
    console.warn("找不到訂金類型切換欄位");
    return;
  }

  const isPercent = typeSelect.value === "percent";

  // 比例制：顯示比例，隱藏固定金額
  percentField.hidden = !isPercent;

  // 固定金額：顯示金額，隱藏比例
  amountField.hidden = isPercent;
}

// 只綁定一次
$("booking_deposit_type")?.addEventListener(
  "change",
  updateBookingDepositFields
);
  $("newBookingNoticeBtn").addEventListener("click", async () => {
    const { error } = await db.from("booking_notices").insert({
      title: "新須知",
      content: "",
      is_visible: true,
      sort_order: bookingNotices.length + 1,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadBookingNotices();
  });
  $("bookingNoticeList").addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-save-notice]");
    const deleteButton = event.target.closest("[data-delete-notice]");

    if (saveButton) {
      const id = saveButton.dataset.saveNotice;

      const title = document.querySelector(`[data-notice-title="${id}"]`).value;

      const content = document.querySelector(
        `[data-notice-content="${id}"]`,
      ).value;

      const sortOrder = Number(
        document.querySelector(`[data-notice-order="${id}"]`).value,
      );

      const isVisible = document.querySelector(
        `[data-notice-visible="${id}"]`,
      ).checked;

      const { error } = await db
        .from("booking_notices")
        .update({
          title,
          content,
          sort_order: sortOrder,
          is_visible: isVisible,
        })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      toast("訂房須知已儲存");
      await loadBookingNotices();
    }

    if (deleteButton) {
      const id = deleteButton.dataset.deleteNotice;

      if (!confirm("確定刪除這則訂房須知？")) {
        return;
      }

      const { error } = await db.from("booking_notices").delete().eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      toast("訂房須知已刪除");
      await loadBookingNotices();
    }
  });

  // ============================================================
  // 13. 聯絡方式 CRUD 與拖曳排序
  // ============================================================
  async function loadContactLinks() {
    const { data, error } = await db
      .from("contact_links")
      .select("*")
      .order("sort_order");

    if (error) {
      alert(`聯絡方式載入失敗：${error.message}`);
      return;
    }

    contactLinks = data || [];
    renderContactLinksAdmin();
  }

  function escapeHtml(value = "") {
    return String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  $("newContactLinkBtn").addEventListener("click", async () => {
    const { error } = await db.from("contact_links").insert({
      type: "link",
      title: "新的聯絡方式",
      value: "",
      is_visible: true,
      sort_order: contactLinks.length + 1,
    });

    if (error) {
      alert(`新增失敗：${error.message}`);
      return;
    }

    toast("已新增聯絡方式");
    await loadContactLinks();
  });

  $("contactLinkList").addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-save-contact]");

    const deleteButton = event.target.closest("[data-delete-contact]");

    if (saveButton) {
      const id = saveButton.dataset.saveContact;

      const type = document.querySelector(`[data-contact-type="${id}"]`).value;

      const title = document
        .querySelector(`[data-contact-title="${id}"]`)
        .value.trim();

      const value = document
        .querySelector(`[data-contact-value="${id}"]`)
        .value.trim();

      const sortOrder = Number(
        document.querySelector(`[data-contact-order="${id}"]`).value,
      );

      const isVisible = document.querySelector(
        `[data-contact-visible="${id}"]`,
      ).checked;

      if (!title) {
        alert("請輸入按鈕文字。");
        return;
      }

      const { error } = await db
        .from("contact_links")
        .update({
          type,
          title,
          value,
          sort_order: sortOrder,
          is_visible: isVisible,
        })
        .eq("id", id);

      if (error) {
        alert(`儲存失敗：${error.message}`);
        return;
      }

      toast("聯絡方式已儲存");
      await loadContactLinks();
    }

    if (deleteButton) {
      const id = deleteButton.dataset.deleteContact;

      if (!confirm("確定刪除這個聯絡方式？")) {
        return;
      }

      const { error } = await db.from("contact_links").delete().eq("id", id);

      if (error) {
        alert(`刪除失敗：${error.message}`);
        return;
      }

      toast("聯絡方式已刪除");
      await loadContactLinks();
    }
  });

  function renderContactLinksAdmin() {
    const container = $("contactLinkList");

    if (!container) {
      console.error("找不到聯絡方式容器：#contactLinkList");
      return;
    }

    container.innerHTML =
      contactLinks
        .map(
          (item) => `
      <article
        class="dynamic-item"
        data-contact-id="${item.id}"
      >
        <button
          type="button"
          class="drag-handle"
          aria-label="拖曳調整順序"
          title="拖曳調整順序"
        >
          ☰
        </button>

        <label class="checkbox">
          <input
            type="checkbox"
            data-contact-visible="${item.id}"
            ${item.is_visible ? "checked" : ""}
          >
          前台顯示
        </label>

        <label>
          排序
          <input
            type="number"
            min="1"
            value="${Number(item.sort_order) || 0}"
            data-contact-order="${item.id}"
          >
        </label>

        <label>
          類型
          <select data-contact-type="${item.id}">
            <option value="line" ${item.type === "line" ? "selected" : ""}>LINE</option>
            <option value="instagram" ${item.type === "instagram" ? "selected" : ""}>Instagram</option>
            <option value="phone" ${item.type === "phone" ? "selected" : ""}>電話</option>
            <option value="email" ${item.type === "email" ? "selected" : ""}>Email</option>
            <option value="facebook" ${item.type === "facebook" ? "selected" : ""}>Facebook</option>
            <option value="link" ${item.type === "link" ? "selected" : ""}>其他連結</option>
          </select>
        </label>

        <label class="wide">
          按鈕文字
          <input
            type="text"
            value="${escapeHtml(item.title || "")}"
            data-contact-title="${item.id}"
            placeholder="例如：電話：0912-345-678"
          >
        </label>

        <label class="wide">
          網址／電話／Email
          <input
            type="text"
            value="${escapeHtml(item.value || "")}"
            data-contact-value="${item.id}"
            placeholder="電話填號碼；其他類型填完整網址"
          >
        </label>

        <div class="item-actions">
          <button
            type="button"
            data-save-contact="${item.id}"
          >
            儲存
          </button>

          <button
            type="button"
            class="danger"
            data-delete-contact="${item.id}"
          >
            刪除
          </button>
        </div>
      </article>
    `,
        )
        .join("") || "<p>目前尚無聯絡方式。</p>";

    initContactLinkSortable();
  }

  function initContactLinkSortable() {
    const container = $("contactLinkList");

    if (!container || typeof Sortable === "undefined") {
      return;
    }

    if (contactLinkSortable) {
      contactLinkSortable.destroy();
    }

    contactLinkSortable = Sortable.create(container, {
      animation: 180,
      handle: ".drag-handle",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",

      onEnd: async () => {
        await saveDraggedOrder({
          container,
          table: "contact_links",
          itemSelector: "[data-contact-id]",
          idAttribute: "contactId",
          orderInputAttribute: "data-contact-order",
          reload: loadContactLinks,
        });
      },
    });
  }

  // ============================================================
  // 14. 共用拖曳排序儲存函式
  // ============================================================
  async function saveDraggedOrder({
    container,
    table,
    itemSelector,
    idAttribute,
    orderInputAttribute,
    reload,
  }) {
    const items = [...container.querySelectorAll(itemSelector)];

    const updates = items
      .map((item, index) => {
        const id = item.dataset[idAttribute];
        const sortOrder = index + 1;

        const orderInput = item.querySelector(`[${orderInputAttribute}]`);

        if (orderInput) {
          orderInput.value = sortOrder;
        }

        return id ? { id, sort_order: sortOrder } : null;
      })
      .filter(Boolean);

    if (!updates.length) {
      return;
    }

    try {
      await Promise.all(
        updates.map(async (row) => {
          const { error } = await db
            .from(table)
            .update({ sort_order: row.sort_order })
            .eq("id", row.id);

          if (error) {
            throw error;
          }
        }),
      );

      toast("排序已更新");

      if (typeof reload === "function") {
        await reload();
      }
    } catch (error) {
      alert(`排序更新失敗：${error.message}`);

      if (typeof reload === "function") {
        await reload();
      }
    }
  }





  
})();
