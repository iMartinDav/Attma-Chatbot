# Email System

This document provides an overview of the email system implemented in Attma Chatbot, including its architecture, configuration, and usage guidelines for developers.

## Overview

Attma utilizes a transactional email system to enhance user experience by sending:

- **Welcome emails** when users create a new account
- **Password reset emails** when users need to reset their passwords

The email system is built on [React Email](https://react.email/) for templating and [Resend](https://resend.com) for email delivery.

## Architecture

```
lib/
└── email/
    ├── resend.ts            # Resend API client configuration
    └── services.ts          # Email service functions
emails/
└── welcome.tsx             # Welcome email template
└── reset-password.tsx      # Password reset email template
app/
└── api/
    └── email/
        ├── welcome/        # API route for welcome emails
        └── reset-password/ # API route for password reset emails
```

## Resend Configuration

The Resend API client is initialized in `lib/email/resend.ts`.

## Email Templates

### Welcome Email

Sent when a user:
- Creates a new account through the registration form
- Signs up using Google OAuth

**Template location:** `/emails/welcome.tsx`

### Password Reset Email

Sent when a user requests a password reset through the forgot password form.

**Template location:** `/emails/reset-password.tsx`

## Developer Usage

### Sending a Welcome Email

### Sending a Password Reset Email

### Using the API Routes

You can also send emails via API routes.

## Previewing Email Templates

You can preview your email templates using the React Email development server:

```
npm run email:dev
```

This will start a server at [http://localhost:3001/preview](http://localhost:3001/preview) where you can:

- View all available email templates
- See how they render in different email clients
- Test them with different props
- Export them as HTML

### Available Scripts in `package.json`:

- `email:dev`: Start the development preview server
- `email:build`: Build the email templates
- `email:export`: Export the templates as HTML files

## Integration Points

### Registration Flow
When a new user registers via the registration form, the welcome email is triggered in the registration API route.

### Google Sign-In Flow
When a new user registers via Google OAuth, the welcome email is triggered in the `auth.ts` `signIn` callback.

### Password Reset Flow
When a user requests a password reset, the email is triggered in the `forgot-password` API route.

## Testing Emails

For development and testing:

- Use the React Email preview server:

  ```
  pnpm run email:dev
  ```

- Use the test API endpoint.
- Create unit tests for email templates.

## Email Template Guidelines

When creating new email templates:

- **Base Structure**: Use the existing templates as a starting point.
- **Styling**: Use Tailwind CSS for styling (already set up with `@react-email/tailwind`).
- **Responsive Design**: Ensure your emails look good on all devices.
- **Preview Props**: Always define `PreviewProps` for React Email previews.
- **Images**: Host images on your domain and use absolute URLs.

## Best Practices

- **Error Handling**: Always catch errors when sending emails and log them, but don't block the main user flow.
- **Security**: Never include sensitive information in emails.
- **Branding**: Follow the design guidelines with the Attma color palette (`#4EF9DB`).
- **Plain Text**: Email clients handle CSS differently, keep designs simple.
- **Performance**: Email sending should be non-blocking where possible.

## Troubleshooting

Common issues:

- **Emails not sending**: Check your `RESEND_API_KEY` and rate limits.
- **Template issues**: Use the preview server to debug template rendering.
- **Styling issues**: Email clients render CSS differently, test thoroughly.
- **Images not displaying**: Ensure image paths are absolute URLs.

## Resources

- [React Email Documentation](https://react.email/)
- [Resend Documentation](https://resend.com)
- [Email Template Best Practices](https://www.emailbestpractices.com)
