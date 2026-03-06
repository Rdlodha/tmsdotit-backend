const nodemailer = require("nodemailer");
const dns = require("dns");

// Force IPv4 for Node.js >= 17 to fix ENETUNREACH IPv6 issue (e.g., on Render)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
}
/**
 * Send an email using Nodemailer.
 * @param {{ to: string, subject: string, text?: string, html?: string }} options
 */
async function sendEmail({ to, subject, text, html }) {
    // Manually force IPv4 resolution to fix ENETUNREACH IPv6 issue explicitly
    const smtpIp = await new Promise((resolve, reject) => {
        dns.lookup("smtp.gmail.com", { family: 4 }, (err, address) => {
            if (err) reject(err);
            else resolve(address);
        });
    });

    const transporter = nodemailer.createTransport({
        host: smtpIp,
        port: 465,
        secure: true, // use SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            // Because we are connecting via IP address, we must provide the servername for SNI
            servername: "smtp.gmail.com",
            rejectUnauthorized: false
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        //|| process.env.EMAIL_USER,
        to,
        subject,
        text,
        html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info;
}

module.exports = sendEmail;
