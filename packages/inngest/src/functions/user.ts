import { inngest } from "../client.js";
import { events } from "../events.js";
import { sendEmail } from "../email/mailer.js";

/* ------------------------------------------------------------------ *
 * Example background function: react to a newly created user.
 *
 * Demonstrates the *other* half of Inngest — reacting to an event your
 * app emits (see the Better Auth `databaseHooks` in apps/server/auth.ts)
 * rather than orchestrating a multi-step workflow.
 * ------------------------------------------------------------------ */
export const sendWelcomeEmail = inngest.createFunction(
  {
    id: "send-welcome-email",
    name: "Send welcome email",
    retries: 2,
    triggers: [{ event: events.userCreated }],
  },
  async ({ event, step }) => {
    const { email, name } = event.data;

    await step.run("send-email", async () => {
      const info = await sendEmail({
        to: email,
        subject: "Welcome to Codesetu 🎉",
        text: `Hi ${name}, welcome to Codesetu — your idea-to-deploy pipeline awaits.`,
        html: `<p>Hi ${name},</p><p>Welcome to <strong>Codesetu</strong> — your idea-to-deploy pipeline awaits.</p>`,
      });
      return { sent: true, to: email, messageId: info.messageId };
    });

    return { delivered: true };
  }
);
