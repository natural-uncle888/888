exports.handler = async (event) => {
  // 只允許 POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // 解析 body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { password } = body || {};

  // 從 Netlify 環境變數讀角色密碼
  const adminPw   = process.env.ADMIN_PASSWORD;
  const managerPw = process.env.MANAGER_PASSWORD;
  const viewerPw  = process.env.VIEWER_PASSWORD;

  let role = null;

  if (password && adminPw && password === adminPw) {
    role = "admin";
  } else if (password && managerPw && password === managerPw) {
    role = "manager";
  } else if (password && viewerPw && password === viewerPw) {
    role = "viewer";
  }

  if (!role) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "wrong password" }),
    };
  }

  // 成功：只回傳角色，不回傳密碼
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ role }),
  };
};