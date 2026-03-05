const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,        
  port: Number(process.env.SMTP_PORT),
  secure: false,                      
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendDownloadLinkMail(to, downloadLink) {
  const safeLink = String(downloadLink || "").trim();

  await transporter.sendMail({
    from: `"Export Service" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your Export File Is Ready",
   html: `
      <div style="background-color:#0b1f3a; padding:40px 0; font-family:Arial, sans-serif;">
        <div style="max-width:600px; margin:0 auto; background:#102b52; padding:30px; border-radius:12px; text-align:center; box-shadow:0 8px 20px rgba(0,0,0,0.3);">
          
          <h2 style="color:#FFD700; margin-bottom:20px;">
             Your Export is Ready
          </h2>

          <p style="color:#FFD700; font-size:16px; margin-bottom:25px;">
            Your requested export file has been successfully generated.
            Click the button below to download it.
          </p>

          <a href="${safeLink}"
            style="
                display:inline-block;
                padding:14px 28px;
                background-color:#00c3ff;
                color:#0b1f3a;
                text-decoration:none;
                font-weight:bold;
                border-radius:8px;
                font-size:16px; ">
            ⬇ Download File
          </a>

          <p style="color:#FFD700; font-size:14px; margin-top:30px;">
             The password will be sent in a separate email for security reasons.
          </p>

          <p style="color:#FFD700; font-size:12px; margin-top:20px; opacity:0.8;">
            This link will expire in 1 hour.
          </p>

        </div>
      </div>
    `,
  });
}

async function sendPasswordMail(to, password) {
  await transporter.sendMail({
    from: `"Export Service" <${process.env.SMTP_USER}>`,
    to,
    subject: "Password For Your Export File",
    html: `
      <div style="background-color:#0b1f3a; padding:40px 0; font-family:Arial, sans-serif;">
        <div style="max-width:600px; margin:0 auto; background:#102b52; padding:30px; border-radius:12px; text-align:center; box-shadow:0 8px 20px rgba(0,0,0,0.3);">
          
          <h2 style="color:#FFD700; margin-bottom:20px;">
             Export File Password
          </h2>

          <p style="color:#FFD700; font-size:16px; margin-bottom:20px;">
            Use the password below to unlock your exported file:
          </p>

          <div style="
              background-color:#FFD700;
              color:#0b1f3a;
              padding:15px;
              border-radius:8px;
              font-size:22px;
              font-weight:bold;
              letter-spacing:2px;
              display:inline-block;
            ">
            ${password}
          </div>

          <p style="color:#FFD700; font-size:14px; margin-top:30px;">
            ⚠ This file will expire in 1 hour.
          </p>

          <p style="color:#FFD700; font-size:12px; margin-top:15px; opacity:0.8;">
            For security reasons, do not share this password with anyone.
          </p>

        </div>
      </div>
    `
  });
 }

 module.exports = { sendDownloadLinkMail,sendPasswordMail, };
