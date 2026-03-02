const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendExportMail(to, downloadLink) {
  await transporter.sendMail({
    from: `"Export Service" <${process.env.MAIL_USER}>`,
    to,
    subject: "Your Export Is Ready ",
    html: `
      <h2>Your export is ready</h2>
      <p>Click below to download:</p>
      <a href="${downloadLink}">Download File</a>
    `,
  });
}

module.exports = { sendExportMail };