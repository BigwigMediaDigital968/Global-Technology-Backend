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
        email: "support@globaltechnologiesindia.com",
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      headers: {
        "List-Unsubscribe": "<mailto:unsubscribe@globaltechnologiesindia.com>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
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
    console.error(
      "❌ Brevo Full Error:",
      JSON.stringify(error.response?.body || error, null, 2),
    );
  }
};

module.exports = sendEmail;
