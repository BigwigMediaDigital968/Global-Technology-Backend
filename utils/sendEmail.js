const SibApiV3Sdk = require("sib-api-v3-sdk");
require("dotenv").config();

// Initialize Brevo client
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

/**
 * sendEmail function
 * @param {Object} param
 * @param {string} param.to - Recipient email
 * @param {string} param.subject - Email subject
 * @param {string} param.html - HTML content
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      sender: {
        name: "Global Technologies",
        email: "support@bigwigmediadigital.com",
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log(`✅ Email sent to ${to} successfully via Brevo`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to} via Brevo:`, error.response?.body || error);
  }
};

module.exports = sendEmail;
