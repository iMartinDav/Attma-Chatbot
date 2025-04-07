import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 128,
        background: 'linear-gradient(to bottom, #f5f5f5, #e5e5e5)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 40,
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
            fill="#333"
          />
          <path
            d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4 4-1.79 4-4 4z"
            fill="#333"
          />
          <circle cx="12" cy="12" r="2" fill="#333" />
        </svg>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            marginLeft: 24,
            background: 'linear-gradient(to right, #4f46e5, #8b5cf6, #ec4899)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Attma
        </div>
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 500,
          color: '#333',
          textAlign: 'center',
        }}
      >
        The World&apos;s First AI Bioinformatician
      </div>
    </div>,
    {
      ...size,
    },
  );
}
