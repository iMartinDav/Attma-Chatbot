import type * as React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Img,
  Link,
} from '@react-email/components';

interface WelcomeEmailProps {
  username?: string;
  userEmail?: string;
  signupMethod?: 'email' | 'google';
  resetLink?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://geniechatbot.vercel.app';
const brandColor = '#4EF9DB';
const accentColor = '#8A67FF';
const backgroundColor = '#f9f9fc';
const textColor = '#303545';
const secondaryTextColor = '#6B7280';
const logoUrl = 'https://placehold.co/520x520/4EF9DB/FFFFFF.png?text=Attma';
const logoBase64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAADXUlEQVR4nO2Yz08TQRTHN1q8Ad5M9GZI9OjRv8GLJ08m/gEkpAgkoBgwxgMXbh4oiAFjhIQfhcYfBZTwQ6IiJFAEtEhpLQW6P7rd7vaZ9y7dbXe6u7CwZSdM8uY0O29mvt33vn3vNYHAf/nXxePxBdM0V/BxuVlOMJ9Igi7guBEnGsiXGNj54yNnHCWQSBCwHOQqn3EJOBCcUZAveK4IWMGZIF9xTQKW0wTKgau/xcA/p+9t7HAJ/PglAV/vfFqA9DEJ7wilVP5TJdFs/O0SsJzVj+fq4ahe1mQw0NJSNbd0KDWHtVqcddL3cE5ex3OUJUAfiv9mzWrgpZm5VBJYIV90saEAhNME+6oIJXHqLdPXWi2BCvDDUoKsspdQ2ltpBTZ9kX6HvNUXGQCI3UV4Fdn1tiDkv3srwD4/POUFfqGxqa5PzT3CeVnALypeHAueF90EeCQ8lfwCN1/V9YRRTU9B37NRaUbxWNgUu4iIeBavrojo8zLlJQQ9dyKeL4TCdT09VVsQUqyTWFKWdnBKuwkACEMG+bKe0ZeUT47Tz4Qoc0h4MykZOJ+lXx3gLje77wmISiBHZy7tNPQsxNJmFdwhFQmChgAw7CLBN0n0f4fa3gdV8I/paSM5rxtDI0lcO6bpAIfVW+CIWy48A1mNUGhseUkFr84nOBsLHAwLsng3K3xD+UAFZ+o5p6UNgGtQAGsqno9X9IIrM1IMcMmTeSPgT/uzo70KuFPGx8ZVcN4eU5wxDa7TSYArV7sJvLp8q0YFj+lxIpmngWDYuGDsioV3BrvnDp8VG6j+y108d0IBT+YLbHtc0IL/TWgrAIlmtGyl3PcCkxNM/Z418cqmqoBv9V9YVMGroVAsxRUKClwJJbSpTgKiQNb2VkxHxuPEmQ2Bhx4OT9XDh8embHB14zp4csqAF1N4FnBnkeD/HF3XfgKJnz8UDBvYe+sXExnQX/9+f1IBt+CjsZwGfpDGcxrcWTGxZHzZCvFiv3LKcZbcoPqnFIuS9ubftZ41NH95cWNTBWfqOmtyxqrAHbAQ9AfH1c/JTpIykFPArZOI3H1RcFjZ67wX4C9j0Al+lCYaoOiQt7hPAJ4lv43dQQR5w1lBWQI2kZUEX1JAAF+eiGISN042aaFQGPXzXwdS/kkBIkGC/9LO8g8tmDfGJsMDKgAAAABJRU5ErkJggg==';

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
    maxWidth: '600px',
    margin: '40px auto',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  shapeTop: {
    position: 'absolute',
    top: '0',
    right: '0',
    width: '140px',
    height: '140px',
    backgroundColor: 'rgba(255, 107, 138, 0.08)',
    borderRadius: '0 0 0 100%',
    zIndex: 1,
  },
  logoContainer: {
    width: '110px',
    height: '110px',
    borderRadius: '55px',
    backgroundColor: '#FFFFFF',
    display: 'inline-block',
    padding: '5px',
    boxShadow: '0 4px 16px rgba(255, 107, 138, 0.2)',
    margin: '0 auto',
  },
  logo: {
    display: 'block',
    border: 'none',
    maxWidth: '100px',
    borderRadius: '50px',
  },
  heading: {
    padding: '10px 0 25px',
    fontWeight: 'bold',
    fontSize: '28px',
    lineHeight: '32px',
    color: brandColor, // Fallback for clients that don't support gradients
  },
  text: {
    fontSize: '16px',
    lineHeight: '24px',
    color: textColor,
    padding: '0 0 20px',
  },
  button: {
    borderRadius: '28px',
    backgroundImage: `linear-gradient(to right, ${brandColor}, ${accentColor})`,
    boxShadow: '0 5px 15px rgba(255, 107, 138, 0.25)',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    textDecoration: 'none',
    padding: '14px 30px',
    display: 'inline-block',
    lineHeight: '1.1',
    letterSpacing: '0.5px',
  },
  footer: {
    borderTop: '1px solid #F0F0F7',
    padding: '30px 30px 30px',
    textAlign: 'center',
    backgroundColor: 'rgba(249, 249, 252, 0.5)',
    position: 'relative',
  },
  shapeBottom: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    width: '120px',
    height: '120px',
    backgroundColor: 'rgba(138, 103, 255, 0.08)',
    borderRadius: '0 100% 0 0',
    zIndex: 1,
  },
};

const Feature: React.FC<{ color: string; children: React.ReactNode }> = ({
  color,
  children,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
    <div
      style={{
        minWidth: '8px',
        height: '8px',
        borderRadius: '4px',
        backgroundColor: color,
        marginRight: '12px',
      }}
    />
    <div>{children}</div>
  </div>
);

// New component for cross-client gradient text
const GradientHeading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
    <tr>
      <td align="center">
        {/* Gradient version for modern clients */}
        <div
          style={{
            display: 'inline-block',
            padding: '10px 0 25px',
            fontWeight: 'bold',
            fontSize: '28px',
            lineHeight: '32px',
            background: `-webkit-linear-gradient(left, ${brandColor}, ${accentColor})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            MozBackgroundClip: 'text',
            color: brandColor, // Fallback for clients that don't support gradients
          }}
          className="mobile-heading"
        >
          {children}
        </div>

        {/* Image fallback for clients that don't support gradients */}
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>
          <img
            src={`https://placehold.co/600x100/${brandColor.replace('#', '')}/FFFFFF.png?text=${encodeURIComponent(children as string)}`}
            alt={children as string}
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </div>
      </td>
    </tr>
  </table>
);

export const WelcomeEmail = ({
  username = 'Friend',
  userEmail = 'user@example.com',
  signupMethod = 'email',
}: WelcomeEmailProps) => (
  <Html>
    <Head>
      <style>
        {`
          @media only screen and (max-width: 600px) {
            .main-container { width: 100% !important; padding: 10px !important; }
            .logo { margin: 0 auto !important; }
            .mobile-text { font-size: 16px !important; }
            .mobile-heading { font-size: 24px !important; }
            .mobile-button { display: block !important; width: 80% !important; margin: 0 auto !important; }
            .shape-top, .shape-bottom { display: none !important; }
          }
          .button-hover:hover { background-color: #E55A79 !important; transition: all 0.3s ease; }
          
          /* Gradient text fallbacks */
          .gradient-text {
            color: ${brandColor};
            font-weight: bold;
          }
          @supports(-webkit-background-clip:text) {
            .gradient-text {
              background: linear-gradient(to right, ${brandColor}, ${accentColor});
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
          }
        `}
      </style>
    </Head>
    <Preview>Welcome to Attma - Your AI Assistant!</Preview>
    <Body
      style={{
        margin: '0',
        padding: '0',
        backgroundColor,
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: '16px',
        lineHeight: '1.5',
        color: textColor,
      }}
    >
      <Container style={styles.container} className="main-container">
        <div className="shape-top" style={styles.shapeTop} />
        <Section
          style={{
            textAlign: 'center',
            padding: '40px 20px 30px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={styles.logoContainer}>
            <Img
              src={logoUrl}
              width="100"
              height="100"
              alt="Attma Logo"
              className="logo"
              style={styles.logo}
            />
          </div>
          <div
            style={{
              display: 'none',
              overflow: 'hidden',
              lineHeight: '1px',
              opacity: '0',
              maxHeight: '0',
              maxWidth: '0',
            }}
          >
            <img
              src={logoBase64}
              alt="Attma"
              width="1"
              height="1"
              style={{ display: 'block', border: 'none', maxWidth: '1px' }}
            />
          </div>
        </Section>
        <Section style={{ padding: '0 35px 35px' }}>
          <table width="100%" border={0} cellSpacing={0} cellPadding={0}>
            <tr>
              <td align="center">
                <GradientHeading>Welcome to Genie, {username}!</GradientHeading>
              </td>
            </tr>
            <tr>
              <td
                align="center"
                style={{
                  fontSize: '18px',
                  fontWeight: '500',
                  color: secondaryTextColor,
                  padding: '0 0 28px',
                  letterSpacing: '0.3px',
                }}
              >
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  Your Personal Bioinformatic AI Assistant
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '40px',
                      height: '3px',
                      backgroundColor: brandColor,
                      borderRadius: '3px',
                    }}
                  />
                </span>
              </td>
            </tr>
            <tr>
              <td style={styles.text} className="mobile-text">
                Thank you for joining Attma! We're excited to have you on board.
                {signupMethod === 'google'
                  ? ' You signed up using your Google account.'
                  : ' Your account has been successfully created.'}
              </td>
            </tr>
            <tr>
              <td style={styles.text} className="mobile-text">
                Attma is designed to help you accomplish more through
                intelligent conversations and document analysis.
              </td>
            </tr>
            <tr>
              <td align="center" style={{ padding: '25px 0 35px' }}>
                <a
                  href={`${baseUrl}/chat`}
                  target="_blank" rel="noreferrer"
                  className="button-hover"
                  style={styles.button}
                >
                  Start a conversation
                </a>
              </td>
            </tr>
            <tr>
              <td
                style={{
                  fontSize: '17px',
                  lineHeight: '24px',
                  fontWeight: '500',
                  color: textColor,
                  padding: '0 0 12px',
                }}
              >
                Here's what you can do with Attma:
              </td>
            </tr>
            <tr>
              <td
                style={{
                  fontSize: '16px',
                  lineHeight: '26px',
                  color: secondaryTextColor,
                  paddingLeft: '16px',
                }}
              >
                <Feature color={brandColor}>
                  Chat with our powerful AI assistant
                </Feature>
                <Feature color={accentColor}>
                  Upload and analyze documents
                </Feature>
                <Feature color={brandColor}>Get personalized responses</Feature>
                <Feature color={accentColor}>
                  Access your chat history anytime
                </Feature>
              </td>
            </tr>
            <tr>
              <td style={styles.text} className="mobile-text">
                If you have any questions or need assistance, feel free to reach
                out to our support team.
              </td>
            </tr>
          </table>
        </Section>
        <Section style={styles.footer}>
          <div className="shape-bottom" style={styles.shapeBottom} />
          <table width="100%" border={0} cellSpacing={0} cellPadding={0}>
            <tr>
              <td
                align="center"
                style={{ fontSize: '14px', color: secondaryTextColor }}
              >
                © {new Date().getFullYear()} Attma. All rights reserved.
              </td>
            </tr>
            <tr>
              <td
                align="center"
                style={{
                  fontSize: '14px',
                  color: secondaryTextColor,
                  padding: '10px 0 0',
                }}
              >
                <Link
                  href={`${baseUrl}/settings`}
                  style={{
                    color: secondaryTextColor,
                    textDecoration: 'underline',
                  }}
                >
                  Email Preferences
                </Link>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                <Link
                  href={`${baseUrl}/unsubscribe`}
                  style={{
                    color: secondaryTextColor,
                    textDecoration: 'underline',
                  }}
                >
                  Unsubscribe
                </Link>
              </td>
            </tr>
          </table>
        </Section>
      </Container>
    </Body>
  </Html>
);

WelcomeEmail.PreviewProps = {
  username: 'John Doe',
  userEmail: 'john@example.com',
  signupMethod: 'email',
};

export default WelcomeEmail;
