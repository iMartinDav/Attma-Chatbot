import React from 'react';

export const ChatStyles = () => (
  <style jsx global>{`
    @keyframes gradientShine {
      0% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0% 50%;
      }
    }
    .Attma-text {
      font-family: 'Avenir Next Rounded', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(90deg, #25C6A3, #4EF9DB, #25C6A3);
      background-size: 200% auto;
      color: transparent;
      -webkit-background-clip: text;
      background-clip: text;
      animation: gradientShine 3s ease infinite;
      display: inline-block;
      text-shadow: 0 0 8px rgba(37, 198, 163, 0.4), 0 0 2px rgba(37, 198, 163, 0.2);
    }
  `}</style>
);
