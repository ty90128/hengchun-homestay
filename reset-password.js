(() => {
  const cfg = window.APP_CONFIG || {};

  const db = supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  const $ = id => document.getElementById(id);

  function setupPasswordToggle(buttonId, inputId) {
    $(buttonId).addEventListener("click", () => {
      const input = $(inputId);
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      $(buttonId).textContent = isHidden ? "隱藏" : "顯示";
    });
  }

  setupPasswordToggle("newPasswordToggle", "newPassword");
  setupPasswordToggle("confirmPasswordToggle", "confirmPassword");

  let recoveryReady = false;

  db.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      recoveryReady = true;
      $("resetMessage").textContent =
        "驗證成功，請設定新的密碼。";
    }
  });

  db.auth.getSession().then(({ data }) => {
    if (data.session) {
      recoveryReady = true;
    }
  });

  $("resetPasswordForm").addEventListener("submit", async event => {
    event.preventDefault();

    const newPassword = $("newPassword").value;
    const confirmPassword = $("confirmPassword").value;

    if (!recoveryReady) {
      alert("重設連結無效或已過期，請重新申請忘記密碼。");
      return;
    }

    if (newPassword.length < 8) {
      alert("密碼至少需要 8 碼。");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("兩次輸入的密碼不一致。");
      return;
    }

    const button = $("savePasswordBtn");
    button.disabled = true;
    button.textContent = "儲存中…";

    const { error } = await db.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert(`密碼更新失敗：${error.message}`);
      button.disabled = false;
      button.textContent = "儲存新密碼";
      return;
    }

    alert("密碼已更新，請使用新密碼登入。");

    await db.auth.signOut();

    window.location.href = "admin.html";
  });
})();