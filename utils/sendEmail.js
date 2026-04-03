

async function sendEmail({ to, subject, text, html }) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev" || "noreply@example.com";

    if (!resendApiKey) {
        throw new Error("RESEND_API_KEY is not set in environment variables");
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
            from: fromEmail,
            to,
            subject,
            text,
            html,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Resend API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data;
}

module.exports = sendEmail;
