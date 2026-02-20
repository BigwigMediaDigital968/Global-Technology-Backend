const SibApiV3Sdk = require("sib-api-v3-sdk");
require("dotenv").config();

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      sender: {
        name: "Global Technologies",
        email: "support@bigwigmediadigital.com",
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };

    if (attachments.length > 0) {
      sendSmtpEmail.attachment = attachments.map((file) => ({
        name: file.name,
        content: file.content,
      }));
    }

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error("Brevo Error:", error.response?.body || error);
  }
};

module.exports = sendEmail; // ✅ VERY IMPORTANT
